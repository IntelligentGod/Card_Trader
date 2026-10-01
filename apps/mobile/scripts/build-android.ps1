<#
  Builds a standalone Android APK on Windows.

  Usage (from the repo root):
    powershell -ExecutionPolicy Bypass -File apps\mobile\scripts\build-android.ps1
    powershell -ExecutionPolicy Bypass -File apps\mobile\scripts\build-android.ps1 -ApiUrl http://192.168.1.20:3000/api/v1

  -ApiUrl   API base URL baked into the app. Default targets the Android emulator
            (10.0.2.2 = your PC). For a real phone use your PC's Wi-Fi IP.

  Windows workarounds handled here:
   * The C++ build nests full paths and exceeds Windows' 260-char limit when the
     repo lives in a long folder (e.g. OneDrive\Desktop\Card Trader). We build
     through a short `subst` drive letter instead.
   * The generated project pins the Gradle daemon to Java 25, whose native-access
     warning breaks the CMake step. We pin it to Java 17.
#>
param(
  [string]$ApiUrl = 'http://10.0.2.2:3000/api/v1',
  [string]$Architectures = 'arm64-v8a,x86_64',
  [string]$DriveLetter = 'X'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$drive = "$($DriveLetter):"

# 1. Native project (generated from app.json if missing)
$androidDir = Join-Path $repoRoot 'apps\mobile\android'
if (-not (Test-Path $androidDir)) {
  Write-Host 'Generating native Android project (expo prebuild)...'
  Push-Location (Join-Path $repoRoot 'apps\mobile')
  $env:CI = '1'
  npx expo prebuild --platform android --no-install
  Pop-Location
}

# 2. Local SDK path and Gradle daemon JVM
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
Set-Content -Path (Join-Path $androidDir 'local.properties') -Value "sdk.dir=$($sdk -replace '\\','/')" -Encoding ascii
$daemonJvm = Join-Path $androidDir 'gradle\gradle-daemon-jvm.properties'
if (Test-Path $daemonJvm) {
  (Get-Content $daemonJvm) -replace '^toolchainVersion=.*$', 'toolchainVersion=17' | Set-Content $daemonJvm -Encoding ascii
}

# 3. Short drive letter
$existing = (subst) -match "^$($DriveLetter):\\: => "
if (-not $existing) { subst $drive $repoRoot }
elseif ($existing -notmatch [regex]::Escape($repoRoot)) { throw "$drive is already mapped elsewhere; pass -DriveLetter" }

try {
  # Stale CMake caches remember long paths; clear them.
  Get-ChildItem "$drive\apps\mobile\android", "$drive\node_modules" -Directory -Recurse -Depth 3 -Filter '.cxx' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  $env:NODE_ENV = 'production'
  $env:ANDROID_HOME = $sdk
  Push-Location "$drive\apps\mobile\android"
  Write-Host "Building release APK (API: $ApiUrl)..."
  .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Architectures" --console=plain
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE)" }
  Pop-Location

  $outDir = Join-Path $repoRoot 'build-output'
  New-Item -ItemType Directory -Force $outDir | Out-Null
  $apk = Join-Path $outDir 'CardTrader-release.apk'
  Copy-Item "$drive\apps\mobile\android\app\build\outputs\apk\release\app-release.apk" $apk -Force
  Write-Host "`nAPK: $apk"
  Write-Host 'Install on a running emulator/phone:  adb install -r build-output\CardTrader-release.apk'
}
finally {
  if (-not $existing) { subst $drive /D }
}

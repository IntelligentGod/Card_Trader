<#
  Builds a standalone Android APK on Windows.

  Usage (from the repo root):
    npm run build:android                                              # production server
    npm run build:android -- -Clean                                    # full rebuild from scratch
    npm run build:android -- -ApiUrl http://192.168.1.20:3000/api/v1   # another server (e.g. your PC on Wi-Fi)
    npm run build:android -- -ApiUrl http://10.0.2.2:3000/api/v1       # the Android emulator's host PC

  -ApiUrl   API base URL baked into the app. Default: the production server.
  -Clean    Deletes previous build output and caches first (slower; use when a build behaves oddly).

  Output: build-output\CardTrader-release.apk

  Windows notes:
   * Builds in place. Building through a `subst` drive breaks React Native's codegen
     ("this and base files have different roots"), so keep the repo in a short path
     such as C:\Projects\Card_Trader; very long paths hit the C++ build's 260-char limit.
   * The generated project pins the Gradle daemon to Java 25, whose native-access
     warning breaks the CMake step. It is pinned to Java 17 here.
#>
param(
  [string]$ApiUrl = 'https://slabstorm.com/api/v1',
  [string]$Architectures = 'arm64-v8a,x86_64',
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$androidDir = Join-Path $repoRoot 'apps\mobile\android'

if ($androidDir.Length -gt 60) {
  Write-Warning "The repo path is long ($repoRoot). If the C++ build fails on path length, move the repo to a short folder like C:\Projects\Card_Trader."
}

# 1. Java 17 and the Android SDK
$jdk = $env:JAVA_HOME
if (-not $jdk -or -not (Test-Path (Join-Path $jdk 'bin\java.exe')) -or -not ((Split-Path $jdk -Leaf) -match '17')) {
  $jdk = Get-ChildItem 'C:\Program Files\Microsoft', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^(jdk-?17|temurin-17)' } | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $jdk) { throw 'Java 17 not found. Install it with: winget install --id Microsoft.OpenJDK.17 -e' }
}
$env:JAVA_HOME = $jdk.TrimEnd('\')
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path (Join-Path $sdk 'platforms'))) { throw "Android SDK not found at $sdk. Set ANDROID_HOME." }
$env:ANDROID_HOME = $sdk

# 2. Native project (generated from app.json if missing)
if (-not (Test-Path $androidDir)) {
  Write-Host 'Generating native Android project (expo prebuild)...'
  Push-Location (Join-Path $repoRoot 'apps\mobile')
  $env:CI = '1'
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed ($LASTEXITCODE)" }
  Pop-Location
}

# 3. Local SDK path and Gradle daemon JVM (Java 17; drop the Java 25 download URLs)
Set-Content -Path (Join-Path $androidDir 'local.properties') -Value "sdk.dir=$($sdk -replace '\\','/')" -Encoding ascii
$daemonJvm = Join-Path $androidDir 'gradle\gradle-daemon-jvm.properties'
if (Test-Path $daemonJvm) {
  (Get-Content $daemonJvm) | Where-Object { $_ -notmatch '^toolchainUrl\.' } |
    ForEach-Object { $_ -replace '^toolchainVersion=.*$', 'toolchainVersion=17' } | Set-Content $daemonJvm -Encoding ascii
}

# Build folders hold paths over 260 characters, which Remove-Item can't delete; `rd` with \\?\ can.
$removeDir = { param($dir) if (Test-Path -LiteralPath $dir) { cmd /c "rd /s /q `"\\?\$dir`"" } }

Push-Location $androidDir
try {
  if ($Clean) {
    Write-Host 'Cleaning previous build output and caches...'
    & .\gradlew.bat --stop | Out-Null
    # The Kotlin compile daemon outlives `gradlew --stop` and keeps cache files open.
    Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
      Where-Object { $_.CommandLine -match 'KotlinCompileDaemon|kotlin-compiler' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    foreach ($dir in 'app\build', 'build', '.gradle') { & $removeDir (Join-Path $androidDir $dir) }
    # Native libraries compile into node_modules\<lib>\android\build (incl. Kotlin caches that can corrupt).
    $modules = Join-Path $repoRoot 'node_modules'
    Get-ChildItem $modules -Directory | ForEach-Object { if ($_.Name.StartsWith('@')) { Get-ChildItem $_.FullName -Directory } else { $_ } } |
      ForEach-Object { & $removeDir (Join-Path $_.FullName 'android\build') }
  }
  # Stale CMake caches remember old paths and Java versions; always clear them.
  Get-ChildItem $androidDir, (Join-Path $repoRoot 'node_modules') -Directory -Recurse -Depth 3 -Filter '.cxx' -ErrorAction SilentlyContinue |
    ForEach-Object { & $removeDir $_.FullName }

  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  $env:NODE_ENV = 'production'
  Write-Host "Building release APK (API: $ApiUrl, Java: $env:JAVA_HOME)..."
  $gradleArgs = @('assembleRelease', "-PreactNativeArchitectures=$Architectures", '--console=plain')
  if ($Clean) { $gradleArgs += '--no-build-cache' }
  & .\gradlew.bat @gradleArgs
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE). Scroll up to the first 'What went wrong' for the cause." }
}
finally {
  Pop-Location
}

$outDir = Join-Path $repoRoot 'build-output'
New-Item -ItemType Directory -Force $outDir | Out-Null
$apk = Join-Path $outDir 'CardTrader-release.apk'
Copy-Item (Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk') $apk -Force
(Get-Item $apk).LastWriteTime = Get-Date
Write-Host "`nAPK: $apk  ($([math]::Round((Get-Item $apk).Length / 1MB, 1)) MB, API: $ApiUrl)"
Write-Host 'Install: copy it to the phone and open it, or: adb install -r build-output\CardTrader-release.apk'

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Controls';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import { Surface } from '../../components/Surface';
import type { RootScreenProps } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { articlesIn, HELP_SECTIONS, searchHelp, type HelpArticle } from './articles';
import { contactSupport, SUPPORT_EMAIL } from './contactSupport';

/** Searchable how-to articles, grouped by topic, with a way to reach support. */
export function HelpCenterScreen({ navigation }: RootScreenProps<'HelpCenter'>) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length > 0;
  const open = (article: HelpArticle) => navigation.navigate('HelpArticle', { articleId: article.id });

  return (
    <Screen>
      <TextField
        testID="help-search"
        placeholder="Search help (e.g. recovery code, cash, grade)"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search help articles"
      />

      {searching ? (
        results.length === 0 ? (
          <EmptyState icon="search" title="No articles found" message="Try other words, or contact support below." />
        ) : (
          <Surface style={styles.group}>
            <AppText variant="label" color={colors.textMuted}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </AppText>
            {results.map((article) => (
              <ArticleRow key={article.id} article={article} onPress={() => open(article)} />
            ))}
          </Surface>
        )
      ) : (
        HELP_SECTIONS.filter((s) => s.id !== 'contact').map((section) => (
          <Surface key={section.id} style={styles.group}>
            <View style={styles.sectionTitle}>
              <Ionicons name={section.icon} size={18} color={colors.primary} />
              <AppText variant="heading">{section.title}</AppText>
            </View>
            {articlesIn(section.id).map((article) => (
              <ArticleRow key={article.id} article={article} onPress={() => open(article)} />
            ))}
          </Surface>
        ))
      )}

      <ContactSupportCard onMore={() => navigation.navigate('HelpArticle', { articleId: 'contact-support' })} />
    </Screen>
  );
}

export function ContactSupportCard({ onMore }: { onMore?: () => void }) {
  return (
    <Surface style={styles.group} testID="contact-support">
      <View style={styles.sectionTitle}>
        <Ionicons name="mail-outline" size={18} color={colors.primary} />
        <AppText variant="heading">Contact Support</AppText>
      </View>
      <AppText color={colors.textMuted}>
        Still stuck? Email us at{' '}
        <AppText variant="bodyStrong" selectable>
          {SUPPORT_EMAIL}
        </AppText>
.
      </AppText>
      <Button title="Email support" icon="mail" onPress={() => void contactSupport()} />
      {onMore ? <Button title="What to include" variant="ghost" compact onPress={onMore} /> : null}
    </Surface>
  );
}

function ArticleRow({ article, onPress }: { article: HelpArticle; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      testID={`help-article-${article.id}`}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{article.title}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {article.summary}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 2 },
  pressed: { opacity: 0.7 },
});

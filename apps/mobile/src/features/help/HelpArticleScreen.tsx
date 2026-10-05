import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/States';
import type { RootScreenProps } from '../../navigation/types';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { helpArticle, HELP_SECTIONS, type HelpBlock } from './articles';
import { ContactSupportCard } from './HelpCenterScreen';

export function HelpArticleScreen({ route }: RootScreenProps<'HelpArticle'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const article = helpArticle(route.params.articleId);
  if (!article) return <EmptyState icon="help-circle-outline" title="Article not found" />;
  const section = HELP_SECTIONS.find((s) => s.id === article.section);

  return (
    <Screen>
      <View style={styles.header}>
        {section ? (
          <AppText variant="label" color={colors.primary}>
            {section.title}
          </AppText>
        ) : null}
        <AppText variant="title" accessibilityRole="header">
          {article.title}
        </AppText>
      </View>
      {article.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
      {article.section === 'account' || article.section === 'two-factor' || article.section === 'contact' ? <ContactSupportCard /> : null}
    </Screen>
  );
}

function Block({ block }: { block: HelpBlock }) {
  const styles = useStyles();
  const { colors } = useTheme();
  switch (block.kind) {
    case 'paragraph':
      return <AppText style={styles.paragraph}>{block.text}</AppText>;
    case 'steps':
      return (
        <View style={styles.steps}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <AppText variant="caption" color={colors.onPrimary} style={styles.stepNumberText}>
                  {index + 1}
                </AppText>
              </View>
              <AppText style={styles.flex}>{item}</AppText>
            </View>
          ))}
        </View>
      );
    case 'tip':
      return (
        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={18} color={colors.primary} />
          <AppText style={styles.flex}>{block.text}</AppText>
        </View>
      );
  }
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  header: { gap: spacing.xs },
  paragraph: { lineHeight: 22 },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontWeight: '700' },
  tip: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md },
}));

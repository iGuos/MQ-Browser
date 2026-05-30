/**
 * Per-exchange-type advisory for the routing key field shared between
 * PublishDialog and CreateBindingDialog. The "binding" context describes
 * wildcard patterns; the "publish" context describes literal keys. Topic in
 * particular needs different placeholders so the example actually shows the
 * `*` / `#` wildcards when the user is creating a binding.
 */
export interface RkAdvice {
  /** "" = key irrelevant; "value" = exact match; "pattern" = wildcards; "any" = unknown. */
  mode: 'irrelevant' | 'exact' | 'pattern' | 'any'
  /** Should the field be disabled (truly ignored)? */
  disabled: boolean
  /** TranslationKey for the inline hint shown below the field. */
  hintKey: string
  /** TranslationKey for placeholder text. */
  placeholderKey: string
}

export type RkAdviceContext = 'binding' | 'publish'

export function rkAdviceFor(
  exchangeType: string | undefined | null,
  context: RkAdviceContext = 'publish',
): RkAdvice {
  switch (exchangeType) {
    case 'fanout':
      return {
        mode: 'irrelevant',
        disabled: true,
        hintKey: 'rkAdvice.fanout',
        placeholderKey: 'rkAdvice.fanoutPlaceholder',
      }
    case 'headers':
      return {
        mode: 'irrelevant',
        disabled: true,
        hintKey: 'rkAdvice.headers',
        placeholderKey: 'rkAdvice.headersPlaceholder',
      }
    case 'direct':
      return {
        mode: 'exact',
        disabled: false,
        hintKey: 'rkAdvice.direct',
        placeholderKey: 'rkAdvice.directPlaceholder',
      }
    case 'topic':
      return {
        mode: 'pattern',
        disabled: false,
        hintKey: context === 'binding' ? 'rkAdvice.topicBinding' : 'rkAdvice.topicPublish',
        placeholderKey:
          context === 'binding'
            ? 'rkAdvice.topicBindingPlaceholder'
            : 'rkAdvice.topicPublishPlaceholder',
      }
    default:
      return {
        mode: 'any',
        disabled: false,
        hintKey: 'rkAdvice.unknown',
        placeholderKey: 'rkAdvice.unknownPlaceholder',
      }
  }
}

import type { Topic } from '../courseSchema';

export const englishM3Topics: Topic[] = [
  {
    id: 'eng-gen-4',
    title: 'Adjectives: Forms and Order',
    kind: 'language',
    planet: 'Earth',
    summary: 'A comprehensive study of adjectives, their comparative forms, and the specific order in which they appear.',
    lesson: {
      minutes: 25,
      objectives: ['Identify and apply the correct order of adjectives', 'Form and use comparative and superlative adjectives accurately', 'Distinguish adjectives from other modifiers'],
      simple: 'Mastering the use, forms, and ordering of adjectives.',
      blocks: [
        { type: 'text', body: 'Adjectives are words that describe or modify nouns and pronouns, providing more information about an object\'s size, shape, age, color, origin, or material. In English, when multiple adjectives are used to describe a single noun, they follow a very specific order. This is often remembered by the acronym OSASCOMP (Opinion, Size, Age, Shape, Color, Origin, Material, Purpose).' },
        { type: 'example', body: 'Opinion: "beautiful", Size: "large", Age: "old", Shape: "round", Color: "red", Origin: "Italian", Material: "wooden", Purpose: "dining". Combining them correctly: "A beautiful large old round red Italian wooden dining table."' },
        { type: 'text', body: 'Comparative and superlative forms are used when comparing two or more things. Generally, one-syllable adjectives add "-er" and "-est" (tall -> taller -> tallest). Adjectives with three or more syllables use "more" and "most" (beautiful -> more beautiful -> most beautiful). Two-syllable adjectives can vary, with many ending in "-y" changing to "-ier" (happy -> happier).' },
        { type: 'keyTerms', terms: [{term: 'Concept', def: 'See summary'}] },
        { type: 'summary', points: ['Understanding adjective order and forms is essential for natural-sounding English and precise descriptions.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Which sentence has the adjectives in the correct order?', options: ['I bought a wooden beautiful old table.', 'I bought a beautiful old wooden table.', 'I bought an old wooden beautiful table.', 'I bought a beautiful wooden old table.'], answer: 1, why: 'Opinion (beautiful) comes before Age (old), which comes before Material (wooden).' },
        { type: 'mcq', q: 'Identify the comparative form of "good".', options: ['gooder', 'more good', 'better', 'best'], answer: 2, why: '"Good" is an irregular adjective; its comparative form is "better".' },
        { type: 'truefalse', q: 'The adjective order "Size" always comes before "Age".', answer: true, why: 'In the standard adjective order (OSASCOMP), Size precedes Age.' },
        { type: 'fill', q: 'The superlative form of "far" is {{farthest}} or furthest.', answer: 'farthest', why: 'Far has irregular comparative and superlative forms.' },
        { type: 'multi', q: 'Which of the following are adjectives of "Origin"?', options: ['French', 'rectangular', 'ancient', 'Martian'], answers: [0, 3], why: 'French and Martian refer to where something is from.' },
        { type: 'mcq', q: 'Select the correctly ordered phrase:', options: ['A small blue plastic cup', 'A blue small plastic cup', 'A plastic small blue cup', 'A small plastic blue cup'], answer: 0, why: 'Size (small), Color (blue), Material (plastic).' },
        { type: 'mcq', q: 'What is the comparative of "heavy"?', options: ['heavyer', 'more heavy', 'heavier', 'most heavy'], answer: 2, why: 'Two-syllable adjectives ending in "y" drop the "y" and add "ier".' },
        { type: 'fill', q: 'When a noun acts like an adjective (e.g., "race" in "race car"), it is called a noun {{adjunct}}.', answer: 'adjunct', why: 'Noun adjuncts modify other nouns.' },
        { type: 'truefalse', q: '"Most fastest" is grammatically correct.', answer: false, why: 'You cannot use "most" with an adjective that already has the "-est" suffix (double superlative).' },
        { type: 'mcq', q: 'Which adjective describes "Shape"?', options: ['Enormous', 'Square', 'Metallic', 'Ugly'], answer: 1, why: 'Square describes the geometric shape.' },
        { type: 'multi', q: 'Which adjectives correctly modify "dog" in the standard order?', options: ['cute tiny brown', 'brown cute tiny', 'tiny brown cute', 'ferocious huge black'], answers: [0, 3], why: 'Opinion -> Size -> Color.' },
        { type: 'mcq', q: 'Identify the absolute adjective (cannot usually be comparative):', options: ['dead', 'tall', 'smart', 'quiet'], answer: 0, why: 'Absolute adjectives like "dead" or "pregnant" do not logically have degrees.' },
        { type: 'fill', q: 'The superlative form of "bad" is {{worst}}.', answer: 'worst', why: '"Bad" is irregular (bad -> worse -> worst).' },
        { type: 'mcq', q: 'Which phrase contains a purpose adjective?', options: ['A red apple', 'A running shoe', 'A shiny penny', 'A tall building'], answer: 1, why: '"Running" describes the purpose of the shoe.' },
        { type: 'truefalse', q: 'The word "unique" is often considered an absolute adjective.', answer: true, why: 'Unique means "one of a kind", so something cannot logically be "more unique".' }
      ]
    },
  {
    id: 'eng-gen-5',
    title: 'Adverbs: Modification and Placement',
    kind: 'language',
    planet: 'Earth',
    summary: 'An in-depth look at adverbs modifying verbs, adjectives, and other adverbs.',
    lesson: {
      minutes: 25,
      objectives: ['Identify adverbs and the words they modify', 'Understand different categories of adverbs', 'Apply rules for adverb placement'],
      simple: 'Mastering adverbs and their nuanced functions in sentences.',
      blocks: [
        { type: 'text', body: 'Adverbs are incredibly versatile modifiers. While they are most commonly known for modifying verbs (telling how, when, where, or to what extent an action occurs), they can also modify adjectives or even other adverbs. Adverbs are often categorized into types: manner (how), degree (to what extent), place (where), time (when), and frequency (how often).' },
        { type: 'example', body: 'Modifying a verb: "She ran quickly." (Manner). Modifying an adjective: "She was extremely fast." (Degree). Modifying another adverb: "She ran incredibly quickly." (Degree modifying Manner).' },
        { type: 'text', body: 'Adverb placement can change the emphasis or meaning of a sentence. Adverbs of frequency usually go before the main verb but after the verb "to be" (e.g., "I always eat breakfast" vs. "I am always hungry"). Adverbs of manner typically go after the main verb or after the object if there is one.' },
        { type: 'keyTerms', terms: [{term: 'Concept', def: 'See summary'}] },
        { type: 'summary', points: ['Adverbs add crucial detail to actions and descriptions, and their placement must be carefully considered for clear communication.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Identify the adverb in: "The very loud alarm startled us."', options: ['The', 'very', 'loud', 'startled'], answer: 1, why: '"Very" is an adverb modifying the adjective "loud".' },
        { type: 'mcq', q: 'In the sentence "He drives surprisingly well," what is "surprisingly" modifying?', options: ['The pronoun "He"', 'The verb "drives"', 'The adverb "well"', 'None of the above'], answer: 2, why: '"Surprisingly" modifies the adverb "well", indicating the degree of how well he drives.' },
        { type: 'truefalse', q: 'Adverbs can modify nouns.', answer: false, why: 'Adjectives modify nouns. Adverbs modify verbs, adjectives, or other adverbs.' },
        { type: 'fill', q: 'An adverb that answers the question "how often?" is an adverb of {{frequency}}.', answer: 'frequency', why: 'Words like "always", "sometimes", and "never" are adverbs of frequency.' },
        { type: 'multi', q: 'Select the adverbs of manner:', options: ['Carefully', 'Yesterday', 'Here', 'Quickly'], answers: [0, 3], why: 'Manner adverbs describe how an action is performed.' },
        { type: 'mcq', q: 'Which sentence has the adverb placed correctly?', options: ['I go usually to the gym.', 'I usually go to the gym.', 'Usually I to the gym go.', 'I go to the gym usually.'], answer: 1, why: 'Adverbs of frequency typically go before the main verb.' },
        { type: 'mcq', q: 'What type of adverb is "outside" in "Let\'s play outside"?', options: ['Manner', 'Degree', 'Time', 'Place'], answer: 3, why: '"Outside" tells where the action takes place.' },
        { type: 'fill', q: 'In the sentence "She almost fell," the word "almost" is an adverb of {{degree}}.', answer: 'degree', why: '"Almost" tells to what extent the action happened.' },
        { type: 'truefalse', q: '"Fast" can be both an adjective and an adverb.', answer: true, why: 'For example, "A fast car" (adjective) and "He runs fast" (adverb).' },
        { type: 'mcq', q: 'Identify the adverb modifying an adjective:', options: ['She sang beautifully.', 'He is quite tall.', 'They arrived late.', 'I will read soon.'], answer: 1, why: '"Quite" is an adverb modifying the adjective "tall".' },
        { type: 'multi', q: 'Which words are irregular adverbs (do not end in -ly)?', options: ['Well', 'Hard', 'Happily', 'Fast'], answers: [0, 1, 3], why: 'Well, hard, and fast are adverbs that do not take an -ly suffix.' },
        { type: 'mcq', q: 'Which sentence demonstrates an adverb modifying another adverb?', options: ['She spoke softly.', 'He ran rather quickly.', 'The building is totally dark.', 'I completely forgot.'], answer: 1, why: '"Rather" modifies the adverb "quickly".' },
        { type: 'fill', q: 'Adverbs often end in the suffix {{-ly}}.', answer: '-ly', why: 'Many adverbs of manner are formed by adding -ly to an adjective.' },
        { type: 'mcq', q: 'Which of the following is an adverb of time?', options: ['Often', 'Now', 'Quietly', 'Almost'], answer: 1, why: '"Now" tells when an action occurs.' },
        { type: 'truefalse', q: 'The word "hardly" means the same as "hard" but is used as an adverb.', answer: false, why: '"Hardly" means "barely" or "scarcely", whereas the adverbial form of "hard" (with effort) is just "hard".' }
      ] }
];




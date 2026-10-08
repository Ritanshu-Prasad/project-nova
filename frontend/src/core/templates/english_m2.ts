import type { Topic } from '../courseSchema';

export const englishM2Topics: Topic[] = [
  {
    id: 'eng-gen-2',
    title: 'Verbs: The Engine of Sentences',
    kind: 'language',
    planet: 'Earth',
    summary: 'A deep dive into verbs, their types, and how they function.',
    lesson: {
      minutes: 25,
      objectives: [
        'Differentiate between Action and Linking verbs',
        'Identify Transitive and Intransitive verbs',
        'Understand Auxiliary (Helping) and Lexical verbs',
        'Distinguish between Finite and Non-finite verbs'
      ],
      simple: 'A comprehensive study of verb classifications and functions.',
      blocks: [
        {
          type: 'text',
          body: 'Verbs are often described as the "action words" of a sentence, but they do much more than just show action. They are the engine of a sentence, driving its meaning by expressing actions, states of being, or occurrences. Without a verb, a group of words cannot be a complete sentence.'
        },
        {
          type: 'text',
          body: 'One of the primary distinctions is between Action verbs and Linking verbs. Action verbs express a physical or mental action that a subject performs. Linking verbs, on the other hand, do not show action; instead, they connect the subject of the verb to additional information about the subject (a subject complement).'
        },
        {
          type: 'example',
          body: 'Action Verb: The cheetah *sprinted* across the savanna. (Physical action) \nLinking Verb: The cheetah *seemed* exhausted. ("Seemed" connects "cheetah" to the adjective "exhausted".)'
        },
        {
          type: 'text',
          body: 'Action verbs can be further categorized as Transitive or Intransitive. A Transitive verb requires a direct object to complete its meaning—someone or something that receives the action. An Intransitive verb does not require a direct object.'
        },
        {
          type: 'example',
          body: 'Transitive: The chef *tasted* the soup. (The action "tasted" is done to "the soup".)\nIntransitive: The baby *slept* soundly. (No one is receiving the action of sleeping.)\nSome verbs can be both: She *sang* a song (Transitive) vs. She *sang* beautifully (Intransitive).'
        },
        {
          type: 'text',
          body: 'Another crucial concept is the difference between Auxiliary (Helping) verbs and Lexical (Main) verbs. Lexical verbs carry the main meaning of the verb phrase. Auxiliary verbs are used with lexical verbs to express tense, mood, or voice. The primary auxiliaries are forms of "be," "do," and "have." Modal auxiliaries (can, could, shall, should, will, would, may, might, must) express necessity or possibility.'
        },
        {
          type: 'example',
          body: 'In the sentence "They *have been studying* for hours," "studying" is the lexical verb, while "have" and "been" are auxiliary verbs establishing the perfect continuous tense.'
        },
        {
          type: 'text',
          body: 'Finally, verbs can be Finite or Non-finite. Finite verbs show tense, person, and number, and can serve as the root of an independent clause. Non-finite verbs (infinitives, gerunds, and participles) do not show tense and cannot act as the main verb of a sentence on their own.'
        },
        {
          type: 'example',
          body: 'Finite: She *walks* to school. (Shows present tense, third-person singular.)\nNon-finite: She likes *to walk* to school. ("To walk" is an infinitive and does not change based on tense or subject.)'
        },
        { type: 'summary', points: ['Verbs are complex words that drive a sentence. Understanding whether a verb is action/linking, transitive/intransitive, auxiliary/lexical, or finite/non-finite is essential for grasping how sentences are constructed and how meaning is conveyed.'] }
      ],
      }, quiz: [
        {
          type: 'mcq',
          q: 'Identify the type of the capitalized verb in the sentence: "The suspect REMAINED silent throughout the interrogation."',
          options: ['Transitive Action Verb', 'Intransitive Action Verb', 'Linking Verb', 'Auxiliary Verb'],
          answer: 2,
          why: '"Remained" connects the subject "suspect" to the adjective "silent", describing a state of being, not an action.'
        },
        {
          type: 'truefalse',
          q: 'True or False: In the sentence "The bird flew away," the verb "flew" is transitive.',
          answer: false,
          why: 'The verb "flew" does not take a direct object here ("away" is an adverb), so it is intransitive.'
        },
        {
          type: 'fill',
          q: 'A verb that requires a direct object to complete its meaning is called a ________ verb.',
          answer: 'transitive',
          why: 'Transitive verbs transfer action to a direct object.'
        },
        {
          type: 'multi',
          q: 'Select all the sentences that contain a Linking Verb.',
          options: [
            'The soup smells delicious.',
            'The dog smelled the hiddden treat.',
            'He grew tired as the day went on.',
            'She grew tomatoes in her garden.'
          ],
          answers: [0, 2],
          why: 'In "smells delicious" and "grew tired", the verbs connect the subject to an adjective. In the others, they are action verbs.'
        },
        {
          type: 'mcq',
          q: 'Which sentence uses "has" as an Auxiliary Verb rather than a Lexical (Main) Verb?',
          options: [
            'She has three older brothers.',
            'The company has a strict attendance policy.',
            'He has already finished the assignment.',
            'We have a problem with the server.'
          ],
          answer: 2,
          why: 'In "He has already finished...", "has" is helping the main verb "finished". In the others, "has" is the main verb showing possession.'
        },
        {
          type: 'mcq',
          q: 'Identify the non-finite verb in the following sentence: "Driven by ambition, the young entrepreneur worked tirelessly to build her startup."',
          options: ['Driven', 'worked', 'tirelessly', 'entrepreneur'],
          answer: 0,
          why: '"Driven" is a past participle acting as a modifier here, not showing tense for the main clause (which is done by the finite verb "worked"). "To build" is also non-finite.'
        },
        {
          type: 'truefalse',
          q: 'True or False: Modal verbs like "might" and "should" are a type of Lexical verb.',
          answer: false,
          why: 'Modal verbs are a type of Auxiliary (helping) verb, not Lexical (main) verbs.'
        },
        {
          type: 'mcq',
          q: 'In the sentence "The committee APPOINTED him chairman," what is the role of the verb "appointed"?',
          options: ['Intransitive Verb', 'Linking Verb', 'Transitive Verb taking a direct object', 'Transitive Verb taking an indirect object'],
          answer: 2,
          why: '"Appointed" is an action done to "him" (direct object), making it transitive. "Chairman" is an object complement.'
        },
        {
          type: 'fill',
          q: 'Verbs that show tense, person, and number, and act as the main verb of a clause are known as ________ verbs.',
          answer: 'finite',
          why: 'Finite verbs are the primary verbs in a clause that agree with the subject and show tense.'
        },
        {
          type: 'multi',
          q: 'Which of the following are Non-finite verbs?',
          options: ['Infinitives', 'Gerunds', 'Modal Auxiliaries', 'Participles'],
          answers: [0, 1, 3],
          why: 'Infinitives (to run), Gerunds (running as noun), and Participles (running as adjective) are non-finite. Modals are auxiliaries.'
        },
        {
          type: 'mcq',
          q: 'Choose the sentence where the verb is Intransitive.',
          options: [
            'She laid the book on the table.',
            'The sun rose over the mountains.',
            'He raised his hand to speak.',
            'The mechanic fixed the car.'
          ],
          answer: 1,
          why: '"Rose" does not take a direct object. "Laid", "raised", and "fixed" all take direct objects.'
        },
        {
          type: 'mcq',
          q: 'What type of verb is capitalized? "The milk TURNED sour overnight."',
          options: ['Action - Transitive', 'Action - Intransitive', 'Linking', 'Auxiliary'],
          answer: 2,
          why: '"Turned" connects the subject "milk" to the adjective "sour", so it is a linking verb here, not a physical turning action.'
        },
        {
          type: 'truefalse',
          q: 'True or False: A sentence can have multiple Auxiliary verbs modifying a single Lexical verb.',
          answer: true,
          why: 'Yes, for example in "would have been going", "would", "have", and "been" are all auxiliaries for the lexical verb "going".'
        },
        {
          type: 'fill',
          q: 'The "-ing" form of a verb when it functions as a noun is called a ________.',
          answer: 'gerund',
          why: 'A gerund is a non-finite verb form ending in -ing that acts as a noun (e.g., "Swimming is fun").'
        },
        {
          type: 'multi',
          q: 'Identify the sentences containing Transitive verbs.',
          options: [
            'The choir sang beautifully.',
            'The choir sang a complicated harmony.',
            'The glass shattered into a thousand pieces.',
            'The baseball shattered the window.'
          ],
          answers: [1, 3],
          why: 'In 1, "sang" takes the object "harmony". In 3, "shattered" takes the object "window". The others are intransitive.'
        }
      ]
    },
  {
    id: 'eng-gen-3',
    title: 'Tense: Navigating Time in English',
    kind: 'language',
    planet: 'Earth',
    summary: 'A detailed exploration of the 12 English tenses and their nuances.',
    lesson: {
      minutes: 30,
      objectives: [
        'Understand the structure and usage of Simple, Continuous, Perfect, and Perfect Continuous tenses',
        'Apply the correct tense across Past, Present, and Future timeframes',
        'Differentiate between closely related tenses like Present Perfect and Past Simple'
      ],
      simple: 'Mastering how verbs change to express exact timing of actions.',
      blocks: [
        {
          type: 'text',
          body: 'Tense is the grammaticalization of time. In English, tense combines with aspect to provide precise information about when an action occurs, how long it lasts, and its relationship to other events. The combination of three timeframes (Past, Present, Future) and four aspects (Simple, Continuous/Progressive, Perfect, Perfect Continuous) creates the 12 English verb tenses.'
        },
        {
          type: 'text',
          body: 'The Simple aspect describes habits, facts, and completed actions. Present Simple ("I eat") states facts or habits. Past Simple ("I ate") refers to completed actions at a specific time in the past. Future Simple ("I will eat") makes predictions, promises, or sudden decisions.'
        },
        {
          type: 'example',
          body: 'Past Simple: He *visited* Paris in 2019. (Completed action at a known time.)\nPresent Simple: Water *boils* at 100 degrees Celsius. (General truth.)\nFuture Simple: I think it *will rain* tomorrow. (Prediction.)'
        },
        {
          type: 'text',
          body: 'The Continuous (or Progressive) aspect emphasizes the ongoing nature of an action at a specific point in time. It is formed with the auxiliary "be" and a present participle (-ing). Past Continuous describes an action that was ongoing when interrupted. Present Continuous describes something happening right now. Future Continuous describes an action that will be ongoing at a specific future time.'
        },
        {
          type: 'example',
          body: 'Past Continuous: I *was reading* when the power went out. \nPresent Continuous: She *is studying* for her finals right now.\nFuture Continuous: At 8 PM tonight, they *will be having* dinner.'
        },
        {
          type: 'text',
          body: 'The Perfect aspect connects two points in time, typically emphasizing the result of a prior action on a later point. It is formed with the auxiliary "have" and a past participle. Past Perfect ("had done") describes an action completed before another past action. Present Perfect ("has/have done") describes a past action with present relevance, often without a specific time. Future Perfect ("will have done") describes an action that will be completed before a specific future time.'
        },
        {
          type: 'example',
          body: 'Past Perfect: By the time we arrived, the movie *had started*.\nPresent Perfect: I *have lost* my keys. (I still do not have them now.)\nFuture Perfect: By next year, I *will have graduated*.'
        },
        {
          type: 'text',
          body: 'Finally, the Perfect Continuous aspect combines the ongoing nature of the continuous with the bridge-building of the perfect. It focuses on the duration of an activity up to a certain point. It uses "have been" + present participle (-ing).'
        },
        {
          type: 'example',
          body: 'Past Perfect Continuous: He *had been waiting* for two hours before the bus finally arrived.\nPresent Perfect Continuous: We *have been painting* the house all day. (And we might still be doing it.)\nFuture Perfect Continuous: By December, she *will have been working* here for five years.'
        },
        { type: 'summary', points: ['Mastering tenses means understanding how time (past/present/future) intersects with aspect (simple/continuous/perfect/perfect continuous). This allows speakers to convey highly nuanced relationships between events.'] }
      ],
      }, quiz: [
        {
          type: 'mcq',
          q: 'Identify the tense used in the sentence: "By the time the rescue team arrives, they will have been stranded for three days."',
          options: ['Future Perfect', 'Future Continuous', 'Future Perfect Continuous', 'Present Perfect Continuous'],
          answer: 2,
          why: '"Will have been stranded" (or more commonly active: "will have been waiting") describes an ongoing action up to a future point, which is Future Perfect Continuous.'
        },
        {
          type: 'truefalse',
          q: 'True or False: The Present Perfect tense is used when stating exactly when a past action occurred (e.g., "I have finished it yesterday").',
          answer: false,
          why: 'Present Perfect is used for indefinite past times or past actions with present results. If a specific time ("yesterday") is given, Past Simple ("I finished it yesterday") must be used.'
        },
        {
          type: 'fill',
          q: 'The tense used to express an action that was ongoing in the past when another action interrupted it is the Past ________ tense.',
          answer: 'Continuous',
          why: 'Past Continuous (e.g., "was watching") is used for the longer, interrupted background action.'
        },
        {
          type: 'multi',
          q: 'Which of the following sentences use the Present Perfect tense?',
          options: [
            'She has visited Japan three times.',
            'He has a large collection of stamps.',
            'They have been living here since 2015.',
            'I have never seen that movie.'
          ],
          answers: [0, 3],
          why: '1 and 4 use "has/have" + past participle. 2 uses "has" as a simple present verb. 3 is Present Perfect Continuous.'
        },
        {
          type: 'mcq',
          q: 'Choose the correct tense to fill in the blank: "When I got to the station, the train ________, so I had to wait for the next one."',
          options: ['left', 'has left', 'had left', 'was leaving'],
          answer: 2,
          why: 'The action of the train leaving happened *before* the other past action of arriving at the station, necessitating the Past Perfect "had left".'
        },
        {
          type: 'mcq',
          q: 'What tense is used for a general truth or scientific fact, such as "Water freezes at 0 degrees Celsius"?',
          options: ['Present Continuous', 'Present Simple', 'Future Simple', 'Present Perfect'],
          answer: 1,
          why: 'The Present Simple tense is used for stating facts, general truths, and habits.'
        },
        {
          type: 'truefalse',
          q: 'True or False: The sentence "I am going to the store tomorrow" uses Present Continuous to express a future arrangement.',
          answer: true,
          why: 'Yes, Present Continuous is frequently used to express planned future arrangements.'
        },
        {
          type: 'mcq',
          q: 'Which tense correctly completes this sentence? "Don\'t call me at 8 PM tonight; I ________ dinner with my family."',
          options: ['will have', 'will be having', 'have', 'will have had'],
          answer: 1,
          why: 'The action will be in progress at a specific time in the future, which requires the Future Continuous "will be having".'
        },
        {
          type: 'fill',
          q: 'The tense formed by "had" + past participle is the Past ________.',
          answer: 'Perfect',
          why: 'Past Perfect is structurally formed using the past tense of have ("had") plus the past participle of the main verb.'
        },
        {
          type: 'multi',
          q: 'Select the sentences that demonstrate the Past Perfect Continuous tense.',
          options: [
            'She had been studying for hours before she fell asleep.',
            'They had built the house by themselves.',
            'I had been driving all night.',
            'He has been complaining about the noise.'
          ],
          answers: [0, 2],
          why: '1 and 3 use "had been" + -ing. 2 is Past Perfect. 4 is Present Perfect Continuous.'
        },
        {
          type: 'mcq',
          q: 'Why is Past Simple incorrect in this context: "Look! He just (drop) his wallet!"',
          options: [
            'Because the action is ongoing.',
            'Because the action happened a long time ago.',
            'Because the action has an immediate connection/result in the present.',
            'Because it is a future prediction.'
          ],
          answer: 2,
          why: 'The exclamation "Look!" shows the past action has immediate present relevance, so Present Perfect ("has just dropped") is required over Past Simple.'
        },
        {
          type: 'mcq',
          q: 'Identify the tense: "Next month, I will have been working at this company for ten years."',
          options: ['Future Perfect', 'Future Perfect Continuous', 'Present Perfect Continuous', 'Future Continuous'],
          answer: 1,
          why: 'It expresses duration up to a future point, using "will have been" + -ing.'
        },
        {
          type: 'truefalse',
          q: 'True or False: Stative verbs (like know, believe, understand) are frequently used in continuous tenses.',
          answer: false,
          why: 'Stative verbs describe states rather than actions and are rarely used in continuous tenses (e.g., we say "I know him", not "I am knowing him").'
        },
        {
          type: 'fill',
          q: 'To form the Future Perfect tense, we use the auxiliaries "will ________" followed by a past participle.',
          answer: 'have',
          why: 'The structure of Future Perfect is will + have + past participle.'
        },
        {
          type: 'multi',
          q: 'Which tenses emphasize the DURATION of an activity?',
          options: [
            'Present Simple',
            'Present Perfect Continuous',
            'Past Perfect Continuous',
            'Past Simple'
          ],
          answers: [1, 2],
          why: 'Perfect Continuous tenses are specifically designed to emphasize the ongoing duration of an activity up to a certain point.'
        }
      ] }
];



import type { Topic } from '../courseSchema';

export const englishM8Topics: Topic[] = [
  {
    id: 'eng-2',
    title: 'Mastering the Comma',
    kind: 'language',
    planet: 'Earth',
    summary: 'A comprehensive guide to using commas correctly in various sentence structures.',
    lesson: {
      minutes: 30,
      objectives: [
        'Understand the role of commas in compound sentences',
        'Use commas correctly with introductory elements',
        'Apply commas to set off nonrestrictive elements',
        'Master the use of commas in a series'
      ],
      simple: 'A deep dive into commas.',
      blocks: [
        { type: 'text', body: 'The comma is one of the most frequently used—and abused—punctuation marks in the English language. Unlike terminal punctuation marks that indicate a full stop, commas act as internal traffic signals within a sentence. They tell the reader to pause, helping to clarify the relationship between different parts of the sentence and preventing misreading.' },
        { type: 'text', body: 'One of the primary uses of the comma is to join two independent clauses along with a coordinating conjunction (for, and, nor, but, or, yet, so—often remembered by the acronym FANBOYS). When two independent clauses are joined this way, a comma must precede the conjunction.' },
        { type: 'example', body: 'Correct: The sky was incredibly dark, and we could hear thunder in the distance.\nIncorrect: The sky was incredibly dark and we could hear thunder in the distance.' },
        { type: 'text', body: 'Commas are also essential after introductory elements. This includes introductory dependent clauses, prepositional phrases, and transitional words. The comma serves to separate this introductory information from the main clause, making the sentence easier to process.' },
        { type: 'example', body: 'Introductory Clause: Because the train was delayed, we missed the beginning of the concert.\nIntroductory Phrase: In the middle of the night, a loud noise woke everyone up.\nTransitional Word: Consequently, the company had to rethink its strategy.' },
        { type: 'text', body: 'Another critical application of the comma is setting off nonrestrictive (nonessential) elements. A nonrestrictive element adds extra information to a sentence but can be removed without changing the core meaning of the sentence. Because it is extra, it is "set off" by commas—one before and one after (unless it ends the sentence).' },
        { type: 'example', body: 'Nonrestrictive: My brother, who lives in Seattle, is an architect. (The speaker has only one brother; "who lives in Seattle" is extra information.)\nRestrictive: The brother who lives in Seattle is an architect. (The speaker has multiple brothers; the phrase identifies which one.)' },
        { type: 'text', body: 'Additionally, commas are used to separate three or more items in a series. The final comma before the conjunction (often "and" or "or") is known as the Oxford comma or serial comma. While some style guides consider it optional, its use often prevents ambiguity.' },
        { type: 'example', body: 'With Oxford comma: We need to buy apples, bananas, and oranges.\nWithout Oxford comma: We need to buy apples, bananas and oranges.\nAmbiguity resolved by Oxford comma: I dedicate this book to my parents, Ayn Rand, and God. (Without the comma, it implies the parents are Ayn Rand and God.)' },
        { type: 'keyTerms', terms: [] },
        { type: 'summary', points: ['Commas provide crucial pauses and separation within sentences. Key rules include using them before FANBOYS when joining independent clauses, after introductory elements, around nonrestrictive clauses, and in a series of items.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Which sentence correctly uses a comma with a coordinating conjunction?', options: ['The dog ran into the house, and chased the cat.', 'The sun set behind the mountains, and the air grew chilly.', 'I wanted to go for a walk, but was too tired.', 'She finished her homework and, went to sleep.'], answer: 1, why: 'A comma is needed before the coordinating conjunction "and" only when it joins two complete independent clauses.' },
        { type: 'mcq', q: 'Identify the sentence with correct punctuation for introductory elements:', options: ['Although it was raining we decided to go hiking.', 'In the ancient forest, towering trees blocked out the sunlight.', 'Suddenly the bird took flight.', 'Because she studied hard she, passed the exam.'], answer: 1, why: 'An introductory prepositional phrase or dependent clause should be followed by a comma before the main independent clause.' },
        { type: 'truefalse', q: 'A comma should always be placed immediately before the word "because".', answer: false, why: 'When "because" introduces a dependent clause that follows the main clause, a comma is usually not needed.' },
        { type: 'fill', q: 'A nonessential or nonrestrictive clause must be enclosed by _____ if it appears in the middle of a sentence.', answer: 'commas', why: 'Commas are used to set off extra information that does not restrict or define the noun it modifies.' },
        { type: 'multi', q: 'Select the sentences that use the Oxford comma correctly:', options: ['The recipe calls for flour, sugar, butter, and eggs.', 'He enjoys reading, writing, and painting.', 'My favorite colors are blue, green and, yellow.', 'She packed a tent, a sleeping bag, and a lantern.'], answers: [0, 1, 3], why: 'The Oxford comma is placed immediately before the coordinating conjunction in a series of three or more items.' },
        { type: 'mcq', q: 'Which sentence incorrectly places a comma?', options: ['My best friend, Alice, is moving to Paris.', 'The car, that was parked outside, was stolen.', 'Dr. Smith, the new principal, addressed the students.', 'Apples, which are high in fiber, make a healthy snack.'], answer: 1, why: 'Restrictive clauses starting with "that" should never be set off by commas, as the information is essential to identify the car.' },
        { type: 'mcq', q: 'Choose the correctly punctuated sentence:', options: ['After the storm passed we surveyed the damage.', 'After the storm passed, we surveyed the damage.', 'After, the storm passed we surveyed the damage.', 'After the storm, passed we surveyed the damage.'], answer: 1, why: 'The introductory dependent clause "After the storm passed" requires a comma before the main clause begins.' },
        { type: 'truefalse', q: 'In the sentence "I love cooking my family and my pets," commas are needed to avoid conveying a gruesome meaning.', answer: true, why: 'Without commas, "cooking" applies to "my family and my pets." Commas are needed: "I love cooking, my family, and my pets."' },
        { type: 'fill', q: 'The acronym used to remember coordinating conjunctions that require a comma when joining two independent clauses is ______.', answer: 'FANBOYS', why: 'FANBOYS stands for For, And, Nor, But, Or, Yet, So.' },
        { type: 'mcq', q: 'Which of the following requires a comma?', options: ['Between two independent clauses without a conjunction.', 'After a short introductory phrase of two words.', 'Before the word "and" when it joins two verbs sharing a subject.', 'Between coordinate adjectives modifying the same noun.'], answer: 3, why: 'Coordinate adjectives (e.g., "a long, winding road") require a comma between them if the word "and" could logically be inserted.' },
        { type: 'mcq', q: 'Which sentence correctly uses commas for coordinate adjectives?', options: ['It was a dark, stormy night.', 'She wore a bright, red dress.', 'He drove a fast, sports car.', 'They walked down a narrow, winding, path.'], answer: 0, why: '"Dark" and "stormy" equally modify "night", so a comma is correct. "Bright red" and "fast sports" are not coordinate. The comma before "path" is incorrect.' },
        { type: 'multi', q: 'Which sentences correctly punctuate a direct address?', options: ["Let's eat, Grandma.", "Let's eat Grandma.", "I don't know, John, what you mean.", 'Thank you for your help Sarah.'], answers: [0, 2], why: 'Nouns of direct address must be set off by commas.' },
        { type: 'truefalse', q: 'When stating dates, a comma separates the day from the year, and another comma follows the year in the middle of a sentence.', answer: true, why: 'Example: On July 4, 1776, the Declaration was signed.' },
        { type: 'mcq', q: 'Which sentence uses commas correctly with geographical locations?', options: ['She was born in Austin Texas on a Tuesday.', 'We visited London, England, during our vacation.', 'They moved to Paris, France in the spring.', 'He lives in Cairo Egypt now.'], answer: 1, why: 'When listing a city and state/country, place a comma between them and another comma after the state/country if the sentence continues.' },
        { type: 'fill', q: 'A comma ____ is a grammatical error that occurs when two independent clauses are joined with just a comma and no coordinating conjunction.', answer: 'splice', why: 'A comma splice incorrectly attempts to use a comma alone to link two full sentences.' }
      ]
    },
  {
    id: 'eng-gen-14',
    title: 'Semicolons: The Elegant Link',
    kind: 'language',
    planet: 'Earth',
    summary: 'Understanding the nuanced power of the semicolon to link closely related ideas.',
    lesson: {
      minutes: 30,
      objectives: [
        'Understand how to use semicolons to connect closely related independent clauses',
        'Learn the difference between semicolons, commas, and periods',
        'Use semicolons with conjunctive adverbs',
        'Apply semicolons to separate items in a complex series'
      ],
      simple: 'A deep dive into semicolons.',
      blocks: [
        { type: 'text', body: 'The semicolon (;) is a punctuation mark of elegant subtlety. It bridges the gap between the heavy, final stop of a period and the brief pause of a comma. Many writers shy away from semicolons out of uncertainty, but mastering them adds rhythm, sophistication, and clarity to your prose.' },
        { type: 'text', body: 'The most common use of the semicolon is to join two independent clauses without using a coordinating conjunction. For a semicolon to be appropriate, the two clauses must be closely related in thought, contrasting, or consequential. By using a semicolon rather than a period, the writer emphasizes the inherent connection between the two ideas.' },
        { type: 'example', body: 'With a period: The project was a massive undertaking. We worked through the weekend to finish it.\nWith a semicolon: The project was a massive undertaking; we worked through the weekend to finish it. (The semicolon highlights that working through the weekend was a direct result of the project\'s scale.)' },
        { type: 'text', body: 'A crucial rule to remember: do not capitalize the word immediately following a semicolon unless that word is a proper noun. The semicolon links two parts of a single sentence, so the second clause does not begin with a capital letter.' },
        { type: 'text', body: 'Semicolons are also frequently used alongside conjunctive adverbs or transitional phrases (such as however, therefore, moreover, consequently, for example, that is) that link two independent clauses. When these transitions sit between two main clauses, a semicolon precedes the transition, and a comma generally follows it.' },
        { type: 'example', body: 'Correct: The weather forecast predicted heavy snow; therefore, we decided to cancel the road trip.\nIncorrect: The weather forecast predicted heavy snow, therefore, we decided to cancel the road trip. (This is a comma splice.)' },
        { type: 'text', body: 'The third vital application of the semicolon is the "super comma" function. When listing items in a series, commas are typically used to separate the items. However, if the items themselves contain internal commas, the reader can easily become confused about where one item ends and the next begins. In these complex lists, semicolons replace the commas between the main items to restore clarity.' },
        { type: 'example', body: 'Complex List: The company has offices in London, England; Paris, France; Tokyo, Japan; and New York, USA.\nWithout Semicolons: The company has offices in London, England, Paris, France, Tokyo, Japan, and New York, USA. (This looks like a list of eight separate places rather than four cities and their countries.)' },
        { type: 'keyTerms', terms: [] },
        { type: 'summary', points: ['Semicolons have two main jobs: connecting closely related independent clauses (often with a conjunctive adverb) and acting as a strong separator in complex lists containing internal commas. They signify a pause stronger than a comma but weaker than a period.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Which sentence correctly uses a semicolon to join two independent clauses?', options: ['The stars were exceptionally bright tonight; but it was very cold.', 'The baker arrived at the shop early; he had hundreds of croissants to prepare.', 'Because the traffic was terrible; we missed the first act of the play.', 'She packed a sweater, a raincoat; and an umbrella.'], answer: 1, why: 'A semicolon correctly joins two closely related independent clauses without a coordinating conjunction.' },
        { type: 'mcq', q: 'Select the sentence that properly punctuates a conjunctive adverb:', options: ['The evidence was circumstantial; however the jury convicted him anyway.', 'The evidence was circumstantial, however, the jury convicted him anyway.', 'The evidence was circumstantial; however, the jury convicted him anyway.', 'The evidence was circumstantial however; the jury convicted him anyway.'], answer: 2, why: 'When a conjunctive adverb joins two independent clauses, use a semicolon before the adverb and a comma after it.' },
        { type: 'truefalse', q: 'You should always capitalize the first letter of the word immediately following a semicolon.', answer: false, why: 'Only capitalize the word after a semicolon if it is a proper noun or an acronym. The semicolon does not end the sentence.' },
        { type: 'fill', q: 'When items in a series contain internal commas, you should use semicolons as a "super _____" to separate the items clearly.', answer: 'comma', why: 'The "super comma" function of the semicolon prevents confusion in complex lists.' },
        { type: 'multi', q: 'Which of the following words are conjunctive adverbs that frequently follow a semicolon when linking clauses?', options: ['furthermore', 'although', 'nevertheless', 'because', 'subsequently'], answers: [0, 2, 4], why: '"Although" and "because" are subordinating conjunctions, not conjunctive adverbs. "Furthermore", "nevertheless", and "subsequently" act as transitions between independent clauses.' },
        { type: 'mcq', q: 'Identify the sentence with the correct use of the "super comma":', options: ['The delegates arrived from Austin, Texas, Seattle, Washington, and Miami, Florida.', 'The delegates arrived from Austin; Texas; Seattle; Washington; and Miami; Florida.', 'The delegates arrived from Austin, Texas; Seattle, Washington; and Miami, Florida.', 'The delegates arrived from; Austin, Texas, Seattle, Washington, and Miami, Florida.'], answer: 2, why: 'Semicolons correctly separate the major units (city, state) of the list, resolving the ambiguity caused by the internal commas.' },
        { type: 'mcq', q: 'Which sentence is a comma splice that could be fixed with a semicolon?', options: ['The dog barked loudly, the intruder ran away quickly.', 'Even though the dog barked loudly, the intruder didn\'t run away.', 'The dog barked loudly, and the intruder ran away quickly.', 'The dog barking loudly, the intruder ran away quickly.'], answer: 0, why: 'Option 1 joins two independent clauses with only a comma. Replacing the comma with a semicolon would correct the error.' },
        { type: 'truefalse', q: 'A semicolon can be used interchangeably with a colon in all situations.', answer: false, why: 'Semicolons link equal independent clauses or separate items in a complex list. Colons are used to introduce lists, quotations, or explanatory independent clauses.' },
        { type: 'fill', q: 'A semicolon represents a pause that is longer than a comma but shorter than a _____.', answer: 'period', why: 'The semicolon is often described as sitting midway between the brief pause of a comma and the full stop of a period.' },
        { type: 'mcq', q: 'Why is the following sentence incorrect? "I love going to the beach; building sandcastles, swimming in the ocean, and relaxing in the sun."', options: ['It uses an Oxford comma incorrectly.', 'The phrase after the semicolon is not an independent clause.', 'The word "building" should be capitalized.', 'Semicolons cannot be used before a list.'], answer: 1, why: 'Semicolons cannot connect an independent clause to a fragment or a dependent phrase. A colon should be used instead to introduce the list.' },
        { type: 'multi', q: 'Which sentences use semicolons CORRECTLY?', options: ['It was raining heavily; therefore, the match was postponed.', 'We visited three cities: Rome, Italy; Paris, France; and Berlin, Germany.', 'Although the engine was repaired; the car still wouldn\'t start.', 'She loves classical music; Mozart and Beethoven are her favorites.'], answers: [0, 1, 3], why: 'Option 2 is incorrect because a semicolon cannot separate a dependent clause ("Although the engine was repaired") from an independent clause.' },
        { type: 'mcq', q: 'If two independent clauses are joined by "and", "but", or "or", do you typically use a semicolon before the conjunction?', options: ['Yes, always.', 'No, you typically use a comma.', 'Yes, if the clauses are very short.', 'No, you use a colon.'], answer: 1, why: 'You generally use a comma with a coordinating conjunction (FANBOYS) to join two independent clauses. A semicolon might be used if the clauses themselves contain many internal commas.' },
        { type: 'truefalse', q: 'Using too many semicolons in a single paragraph can make the writing feel choppy and overly formal.', answer: true, why: 'While useful, semicolons should be used sparingly. Overuse can weigh down the prose and distract the reader.' },
        { type: 'mcq', q: 'Which revision corrects this error? "The CEO announced her retirement, the board immediately began searching for a successor."', options: ['The CEO announced her retirement the board immediately began searching for a successor.', 'The CEO announced her retirement; the board immediately began searching for a successor.', 'The CEO announced her retirement: the board immediately began searching for a successor.', 'The CEO announced her retirement. the board immediately began searching for a successor.'], answer: 1, why: 'Replacing the comma splice with a semicolon effectively joins the two closely related independent clauses.' },
        { type: 'fill', q: 'Do not use a semicolon to join an independent clause with a ____ clause.', answer: 'dependent', why: 'Semicolons must generally link two clauses of equal grammatical rank, usually two independent clauses.' }
      ] }
];




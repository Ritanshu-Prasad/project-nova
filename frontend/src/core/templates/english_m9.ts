import type { Topic } from '../courseSchema';

export const englishM9Topics: Topic[] = [
  {
    id: 'eng-gen-15',
    title: 'Colons: Mastery and Application',
    kind: 'language',
    planet: 'Earth',
    summary: 'A deep dive into the usage of colons in modern English.',
    lesson: {
      minutes: 25,
      objectives: [
        'Identify correct colon usage to introduce lists, quotations, and explanations',
        'Differentiate between contexts that require a colon versus a semicolon',
        'Apply colons correctly in ratios, time, and formal correspondence'
      ],
      simple: 'A deep dive into the usage of colons in modern English.',
      blocks: [
        {
          type: 'text',
          body: 'The colon (:) is a powerful punctuation mark that acts as a flashing arrow, pointing the reader forward to information that explains, expands upon, or lists what has just been stated. Unlike the semicolon, which connects two balanced independent clauses, the colon typically follows an independent clause and introduces something dependent on it.'
        },
        {
          type: 'text',
          body: 'One of the most common uses of a colon is to introduce a list or a series. However, a strict rule governs this: the clause preceding the colon must be an independent clause (a complete sentence). You should not place a colon directly after a verb or a preposition.'
        },
        {
          type: 'example',
          body: 'Correct: The chef required three ingredients: flour, sugar, and yeast.\nIncorrect: The chef required: flour, sugar, and yeast. (The words preceding the colon do not form a complete thought).'
        },
        {
          type: 'text',
          body: 'Colons are also essential for introducing explanations, conclusions, or amplifying ideas. When the second clause explains or illustrates the first, a colon provides the perfect hinge. If the colon introduces a complete sentence, whether to capitalize the first word depends on the style guide, but generally, capitalization is used if the subsequent text is a multi-sentence explanation or a formal quotation.'
        },
        {
          type: 'example',
          body: 'He had only one goal in mind: he wanted to win the championship.\nThe experiment confirmed our worst fears: The containment field was failing, and the core was rapidly overheating.'
        },
        {
          type: 'text',
          body: 'Other standard uses include introducing a long or formal quotation, separating titles from subtitles, displaying ratios, and separating hours from minutes.'
        },
        {
          type: 'keyTerms',
          terms: [{ term: 'Independent Clause', def: 'A group of words containing a subject and a verb that makes sense on its own.' }, { term: 'Amplification', def: 'The process of expanding on a statement to provide more detail.' }] },
        { type: 'summary', points: ['The colon is a forward-looking punctuation mark. It must be preceded by an independent clause and is used to introduce lists, explanations, quotations, or subtitles.'] }
      ],
      }, quiz: [
        {
          type: 'mcq',
          q: 'Which sentence uses a colon correctly to introduce a list?',
          options: [
            'We packed several items for the trip including: tents, sleeping bags, and a stove.',
            'The hiking gear included: tents, sleeping bags, and a stove.',
            'We packed several items for the trip: tents, sleeping bags, and a stove.',
            'For the trip, we packed: tents, sleeping bags, and a stove.'
          ],
          answer: 2,
          why: 'Option 3 is correct because "We packed several items for the trip" is a complete independent clause.'
        },
        {
          type: 'truefalse',
          q: 'You can place a colon immediately after a preposition like "such as" or "including".',
          answer: false,
          why: 'Colons should not separate a preposition from its object. The text preceding the colon must be a complete thought.'
        },
        {
          type: 'mcq',
          q: 'Identify the sentence where a colon is used correctly to introduce an explanation.',
          options: [
            'She knew what she had to do: apologize immediately.',
            'She knew: she had to apologize immediately.',
            'Because she knew what to do: she apologized immediately.',
            'She knew what she had to do, apologize: immediately.'
          ],
          answer: 0,
          why: '"She knew what she had to do" is a complete clause, and "apologize immediately" directly explains what she had to do.'
        },
        {
          type: 'multi',
          q: 'Select ALL the sentences that misuse the colon.',
          options: [
            'My favorite colors are: red, blue, and green.',
            'There is one thing I cannot stand: hypocrisy.',
            'The recipe requires: 2 eggs, milk, and flour.',
            'He read the book: "The Great Gatsby."'
          ],
          answers: [0, 2, 3],
          why: 'Options 0, 2, and 3 place colons after verbs or in places where the preceding text is not an independent clause.'
        },
        {
          type: 'fill',
          q: 'The punctuation mark that acts like a flashing arrow pointing to an explanation or list is the ________.',
          answer: 'colon',
          why: 'The colon directs the reader\'s attention to the subsequent information.'
        },
        {
          type: 'mcq',
          q: 'Which of the following correctly punctuates a title and subtitle?',
          options: [
            'Star Wars; A New Hope',
            'Star Wars: A New Hope',
            'Star Wars - A New Hope',
            'Star Wars, A New Hope'
          ],
          answer: 1,
          why: 'Colons are the standard punctuation mark for separating titles and subtitles.'
        },
        {
          type: 'truefalse',
          q: 'If a colon introduces a complete sentence, the first letter after the colon must always be lowercase.',
          answer: false,
          why: 'Depending on the style guide and the nature of the explanation (especially if it contains multiple sentences), the first word after a colon can be capitalized.'
        },
        {
          type: 'mcq',
          q: 'Which sentence correctly uses a colon for a formal quotation?',
          options: [
            'The speaker stated: "The future belongs to those who prepare for it today."',
            'The speaker stated that: "The future belongs to those who prepare for it today."',
            'According to the speaker: "The future belongs to those who prepare for it today."',
            'The speaker delivered a powerful message: "The future belongs to those who prepare for it today."'
          ],
          answer: 3,
          why: 'Option 4 has a complete independent clause before the colon. The others do not form complete thoughts before the colon.'
        },
        {
          type: 'fill',
          q: 'To use a colon correctly before a list, the preceding text must form an ________ clause.',
          answer: 'independent',
          why: 'A colon must follow an independent clause when introducing a list.'
        },
        {
          type: 'mcq',
          q: 'Choose the correct use of a colon in a ratio or time format.',
          options: [
            'The meeting is at 2;30 PM.',
            'The ratio of apples to oranges is 3:1.',
            'She finished the race in 2-30-45.',
            'We mixed the chemicals in a 1.2 ratio.'
          ],
          answer: 1,
          why: 'Colons are used to represent ratios (3:1) and separate hours from minutes (2:30).'
        },
        {
          type: 'multi',
          q: 'Which of these statements about colons are TRUE?',
          options: [
            'They can connect a dependent clause to a preposition.',
            'They can introduce an explanation or clarification.',
            'They always require a capitalized word immediately after.',
            'They can be used to separate a title from a subtitle.'
          ],
          answers: [1, 3],
          why: 'Colons introduce explanations and separate titles/subtitles. They do not require a capital letter in every context and cannot follow prepositions.'
        },
        {
          type: 'mcq',
          q: 'Which sentence correctly replaces the comma with a colon to improve emphasis?',
          options: [
            'He had only one weakness, chocolate.',
            'He had: only one weakness, chocolate.',
            'He had only one weakness: chocolate.',
            'He had only: one weakness, chocolate.'
          ],
          answer: 2,
          why: 'Replacing the comma with a colon provides a sharper, more dramatic pause before the revelation of the weakness.'
        },
        {
          type: 'truefalse',
          q: 'A colon can be used to join two independent clauses when the second clause illustrates or explains the first.',
          answer: true,
          why: 'While semicolons typically join independent clauses, a colon is preferred when the second clause acts as a direct explanation or continuation of the first.'
        },
        {
          type: 'mcq',
          q: 'Which is the INCORRECT use of a colon?',
          options: [
            'Dear Members of the Board:',
            'The time is now 8:45 AM.',
            'We travelled to: London, Paris, and Rome.',
            'Her motivation was clear: she wanted to win.'
          ],
          answer: 2,
          why: 'A colon should not follow the preposition "to". The preceding text "We travelled to" is not an independent clause.'
        },
        {
          type: 'fill',
          q: 'When writing a formal business letter, a colon is typically used after the ________.',
          answer: 'salutation',
          why: 'In formal business letters, the salutation is followed by a colon (e.g., Dear Mr. Smith:).'
        }
      ]
    },
  {
    id: 'eng-gen-16',
    title: 'Dashes: Em Dashes and En Dashes',
    kind: 'language',
    planet: 'Earth',
    summary: 'Understanding the stylistic and grammatical uses of the em dash and the en dash.',
    lesson: {
      minutes: 25,
      objectives: [
        'Differentiate between an em dash, an en dash, and a hyphen',
        'Apply em dashes for emphasis, interruptions, and non-essential clauses',
        'Apply en dashes for ranges, connections, and complex compound adjectives'
      ],
      simple: 'Understanding the stylistic and grammatical uses of the em dash and the en dash.',
      blocks: [
        {
          type: 'text',
          body: 'Dashes are among the most versatile—and frequently misunderstood—punctuation marks. There are two primary types of dashes used in English: the em dash (—) and the en dash (–). They serve completely different purposes and should not be confused with each other, nor with the humble hyphen (-).'
        },
        {
          type: 'text',
          body: 'The em dash (—) is roughly the width of the letter "m" and is the most common dash. It is incredibly versatile. It can take the place of commas, parentheses, or colons—in each case producing a slightly different rhetorical effect. When used in place of commas or parentheses to set off non-essential information, em dashes draw more attention to the enclosed phrase.'
        },
        {
          type: 'example',
          body: 'Commas: The pie, which was fresh out of the oven, smelled delicious.\nParentheses: The pie (which was fresh out of the oven) smelled delicious.\nEm dashes: The pie—which was fresh out of the oven—smelled delicious.'
        },
        {
          type: 'text',
          body: 'Em dashes are also used to indicate an abrupt change in thought, an interruption in dialogue, or to create a strong dramatic pause before a conclusion.'
        },
        {
          type: 'example',
          body: '"I was thinking that we could—oh, watch out for that car!"\nHe spent his entire life chasing one elusive dream—happiness.'
        },
        {
          type: 'text',
          body: 'The en dash (–), roughly the width of the letter "n", is slightly longer than a hyphen but shorter than an em dash. Its primary function is to indicate spans or ranges of numbers, dates, or time. It is read as "to" or "through".'
        },
        {
          type: 'example',
          body: 'The years 1990–1995 were marked by rapid technological growth.\nPlease read pages 45–60 for homework.'
        },
        {
          type: 'text',
          body: 'An en dash is also used to connect two entities to show a relationship, conflict, or connection, often acting like the word "to" or "versus". Additionally, it is used in compound adjectives where one part of the compound is already a two-word phrase (e.g., a New York–based company).'
        },
        {
          type: 'keyTerms',
          terms: [{ term: 'Em Dash', def: 'A long dash used to indicate pauses }, { term: interruptions, def: or to set off non-essential information for emphasis.' }, { term: 'En Dash', def: 'A mid-length dash used primarily to indicate ranges or connections between distinct entities.' }] },
        { type: 'summary', points: ['The em dash is a highly flexible mark used for emphasis, abrupt changes, and setting off clauses. The en dash is shorter and is used for numerical ranges and directional connections.'] }
      ],
      }, quiz: [
        {
          type: 'mcq',
          q: 'Which sentence correctly uses em dashes to set off non-essential information?',
          options: [
            'The antique clock — a family heirloom — sat on the mantle.',
            'The antique clock, a family heirloom — sat on the mantle.',
            'The antique clock — a family heirloom, sat on the mantle.',
            'The antique clock a family heirloom — sat on the mantle.'
          ],
          answer: 0,
          why: 'When setting off an appositive or non-essential phrase in the middle of a sentence, a pair of em dashes must be used.'
        },
        {
          type: 'truefalse',
          q: 'The en dash is typically used to indicate an abrupt interruption in spoken dialogue.',
          answer: false,
          why: 'The em dash is used for interruptions in dialogue. The en dash is used for ranges and connections.'
        },
        {
          type: 'mcq',
          q: 'Which sentence correctly uses an en dash for a range?',
          options: [
            'The festival runs from May 12—May 15.',
            'The festival runs May 12–15.',
            'The festival runs May 12-15.',
            'The festival runs from May 12 to May 15–.'
          ],
          answer: 1,
          why: 'An en dash (–) correctly indicates a span or range of dates when used without the word "from".'
        },
        {
          type: 'multi',
          q: 'Select ALL valid uses for an em dash.',
          options: [
            'Replacing commas for added emphasis.',
            'Replacing a colon before a conclusion.',
            'Indicating a range of pages in a book.',
            'Showing an abrupt change in thought.'
          ],
          answers: [0, 1, 3],
          why: 'Ranges of pages use an en dash, not an em dash. The other options are valid stylistic uses of the em dash.'
        },
        {
          type: 'fill',
          q: 'When writing about the London–Paris train route, the punctuation mark used between London and Paris is the ________ dash.',
          answer: 'en',
          why: 'The en dash connects two distinct entities to show direction, conflict, or partnership.'
        },
        {
          type: 'mcq',
          q: 'How does the use of em dashes differ from parentheses in a sentence?',
          options: [
            'Em dashes make the enclosed text formal, while parentheses make it informal.',
            'Em dashes draw more attention to the enclosed text, while parentheses de-emphasize it.',
            'Em dashes can only be used at the end of a sentence.',
            'There is no difference; they are always perfectly interchangeable.'
          ],
          answer: 1,
          why: 'Parentheses quietly tuck information away, whereas em dashes shine a spotlight on the enclosed information.'
        },
        {
          type: 'truefalse',
          q: 'You should always put spaces on both sides of an em dash in every major style guide.',
          answer: false,
          why: 'Style guides differ. For example, AP style requires spaces around em dashes, but Chicago style explicitly forbids spaces around them.'
        },
        {
          type: 'mcq',
          q: 'Which is the correct punctuation for a compound adjective where one element is a two-word proper noun?',
          options: [
            'The Nobel Prize-winning author',
            'The Nobel Prize–winning author',
            'The Nobel Prize—winning author',
            'The Nobel-Prize-winning author'
          ],
          answer: 1,
          why: 'An en dash is used to connect a two-word open compound (Nobel Prize) to another word (winning).'
        },
        {
          type: 'fill',
          q: 'To show an abrupt interruption in a character\'s speech, you should use an ________ dash.',
          answer: 'em',
          why: 'Em dashes uniquely represent a sudden cut-off or interruption in dialogue.'
        },
        {
          type: 'mcq',
          q: 'Identify the sentence with incorrect dash usage.',
          options: [
            'The score was tied 4–4 at halftime.',
            'Please read chapters 4—6 by tomorrow.',
            'I have three things to do—laundry, dishes, and sweeping.',
            'The Los Angeles–San Francisco flight is boarding.'
          ],
          answer: 1,
          why: 'Option 2 incorrectly uses an em dash (—) for a numerical range. It should use an en dash (–).'
        },
        {
          type: 'multi',
          q: 'Which of the following punctuation marks can an em dash sometimes replace?',
          options: [
            'Comma',
            'Colon',
            'Parentheses',
            'Question Mark'
          ],
          answers: [0, 1, 2],
          why: 'An em dash is highly versatile and can substitute for commas, colons, or parentheses, but it cannot replace a question mark.'
        },
        {
          type: 'mcq',
          q: 'Which sentence demonstrates the best use of an em dash for a dramatic pause?',
          options: [
            'She opened the door and saw him—standing there.',
            'She opened the door—and saw him standing there.',
            'She opened the door and saw—the ghost of her past.',
            'She opened—the door and saw the ghost.'
          ],
          answer: 2,
          why: 'The dash in option 3 effectively delays the dramatic reveal of "the ghost of her past".'
        },
        {
          type: 'truefalse',
          q: 'The en dash is named because it is roughly the width of the letter "n".',
          answer: true,
          why: 'Typographically, the en dash is traditionally the width of the uppercase letter "N" in a given typeface.'
        },
        {
          type: 'mcq',
          q: 'In the phrase "the post–World War II era", why is an en dash used instead of a hyphen?',
          options: [
            'Because "World War II" is a proper noun.',
            'Because the prefix "post" requires an en dash.',
            'Because "World War II" is an open compound consisting of multiple words.',
            'Because it indicates a span of time.'
          ],
          answer: 2,
          why: 'When attaching a prefix to an open compound (like World War II), an en dash is used to ensure clarity.'
        },
        {
          type: 'fill',
          q: 'The longest of the three horizontal line punctuation marks (hyphen, en dash, em dash) is the ________ dash.',
          answer: 'em',
          why: 'The em dash is the longest, typically the width of the letter "m".'
        }
      ] }
];



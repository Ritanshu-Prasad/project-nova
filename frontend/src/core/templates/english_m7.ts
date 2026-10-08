import type { Topic } from '../courseSchema';

export const englishM7Topics: Topic[] = [
  {
    id: 'eng-gen-12',
    title: 'Simple and Compound Sentences',
    kind: 'language',
    planet: 'Earth',
    summary: 'Understanding the structure of simple and compound sentences.',
    lesson: {
      minutes: 20,
      objectives: ['Identify simple sentences', 'Identify compound sentences', 'Use coordinating conjunctions correctly', 'Differentiate between simple and compound structures'],
      simple: 'A detailed exploration of simple and compound sentence structures, including independent clauses and coordinating conjunctions.',
      blocks: [
        { type: 'text', body: 'A simple sentence, also known as an independent clause, contains a single subject and predicate. It expresses a complete thought and can stand alone. Despite its name, a simple sentence can be long and include compound subjects or compound verbs, but it must only contain one independent clause and no dependent clauses.' },
        { type: 'example', body: '"The weary travelers finally arrived at the cozy inn." (One subject: travelers. One predicate: arrived...)' },
        { type: 'text', body: 'A compound sentence consists of two or more independent clauses joined together. These clauses are typically joined by a coordinating conjunction (for, and, nor, but, or, yet, so - FANBOYS), a semicolon, or a conjunctive adverb.' },
        { type: 'example', body: '"The sun set over the ocean, and the stars began to twinkle." (Two independent clauses joined by "and")' },
        { type: 'text', body: 'It is crucial to differentiate between a simple sentence with a compound predicate and a true compound sentence. If the coordinating conjunction joins two verbs sharing the same subject, it is a simple sentence. If it joins two distinct subject-verb pairs, it is a compound sentence.' },
        { type: 'example', body: '"The cat chased the mouse but failed to catch it." (Simple sentence, compound predicate). "The cat chased the mouse, but the mouse escaped." (Compound sentence, two independent clauses).' },
        { type: 'keyTerms', terms: [{ term: 'Independent Clause: A clause that can stand alone as a sentence. Coordinating Conjunction: Words like FANBOYS used to connect clauses. Compound Predicate: Two or more verbs sharing the same subject.', def: 'See summary' }] },
        { type: 'summary', points: ['Simple sentences have one independent clause, while compound sentences have two or more independent clauses connected appropriately. Pay attention to compound subjects and predicates to avoid misidentifying simple sentences.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Identify the sentence type: "Maria and Julian walked to the park and played frisbee."', options: ['Simple', 'Compound', 'Complex', 'Compound-Complex'], answer: 0, why: 'It is a simple sentence with a compound subject and a compound predicate, but only one clause.' },
        { type: 'mcq', q: 'Which conjunction best connects these clauses to form a compound sentence? "I wanted to go to the concert; ____, the tickets were sold out."', options: ['and', 'so', 'however', 'because'], answer: 2, why: '"However" is a conjunctive adverb that fits the contrasting meaning and the semicolon punctuation.' },
        { type: 'truefalse', q: 'True or False: A simple sentence cannot contain more than ten words.', answer: false, why: 'A simple sentence can be any length as long as it contains only one independent clause.' },
        { type: 'fill', q: 'The acronym used to remember coordinating conjunctions is {{FANBOYS}}.', answer: 'FANBOYS', why: 'FANBOYS stands for For, And, Nor, But, Or, Yet, So.' },
        { type: 'multi', q: 'Select the compound sentences from the list:', options: ['The dog barked, and the mailman ran away.', 'The dog barked loudly at the mailman.', 'We can go to the movies, or we can stay home.', 'Running fast, she caught the bus.'], answers: [0, 2], why: 'Sentences A and C have two independent clauses joined by coordinating conjunctions.' },
        { type: 'mcq', q: 'Which of the following is a simple sentence?', options: ['I like apples, but I hate oranges.', 'After the rain stopped, the sun came out.', 'The tall, dark, and handsome stranger smiled mysteriously.', 'Because he was late, he missed the train.'], answer: 2, why: 'Option C is a single independent clause with multiple adjectives.' },
        { type: 'truefalse', q: 'A semicolon can be used to join two independent clauses in a compound sentence without a conjunction.', answer: true, why: 'Yes, a semicolon is a valid way to connect closely related independent clauses.' },
        { type: 'mcq', q: 'Identify the sentence type: "The alarm rang; I hit snooze."', options: ['Simple', 'Compound', 'Complex', 'Compound-Complex'], answer: 1, why: 'Two independent clauses joined by a semicolon make a compound sentence.' },
        { type: 'fill', q: 'A compound sentence must contain at least {{two}} independent clauses.', answer: 'two', why: 'By definition, a compound sentence joins two or more independent clauses.' },
        { type: 'mcq', q: 'Choose the correct punctuation for this compound sentence: "The storm was fierce __ we decided to stay indoors."', options: [', so', '; so', ' so', ', because'], answer: 0, why: 'A comma followed by a coordinating conjunction (so) is correct.' },
        { type: 'multi', q: 'Which of the following contain a compound predicate but are simple sentences?', options: ['He washed the dishes and dried them.', 'He washed the dishes, and she dried them.', 'They sang and danced all night.', 'They sang, but they didn\'t dance.'], answers: [0, 2], why: 'Options A and C have two verbs for one subject, making them simple sentences.' },
        { type: 'truefalse', q: 'The word "because" is a coordinating conjunction.', answer: false, why: '"Because" is a subordinating conjunction.' },
        { type: 'mcq', q: 'Identify the sentence type: "Neither the players nor the coach was happy with the referee\'s decision."', options: ['Simple', 'Compound', 'Complex', 'Compound-Complex'], answer: 0, why: 'It is a simple sentence with a compound subject joined by correlative conjunctions.' },
        { type: 'fill', q: 'An independent clause contains a subject and a {{predicate}} and expresses a complete thought.', answer: 'predicate', why: 'Every clause needs a subject and a predicate (or verb).' },
        { type: 'mcq', q: 'Which conjunction shows a contrast in a compound sentence?', options: ['and', 'or', 'so', 'but'], answer: 3, why: '"But" is used to show contrast or exception.' }
      ]
    },
  {
    id: 'eng-gen-13',
    title: 'Complex Sentences',
    kind: 'language',
    planet: 'Earth',
    summary: 'Mastering the structure and usage of complex sentences.',
    lesson: {
      minutes: 25,
      objectives: ['Identify complex sentences', 'Recognize subordinating conjunctions', 'Differentiate dependent and independent clauses', 'Understand complex sentence punctuation'],
      simple: 'A deep dive into complex sentences, exploring how dependent clauses interact with independent clauses using subordinating conjunctions.',
      blocks: [
        { type: 'text', body: 'A complex sentence contains one independent clause and at least one dependent (subordinate) clause. The dependent clause adds information to the independent clause but cannot stand alone as a complete sentence.' },
        { type: 'example', body: '"Although it was raining, they decided to go for a hike." (Dependent clause: Although it was raining. Independent clause: they decided to go for a hike.)' },
        { type: 'text', body: 'Dependent clauses often begin with subordinating conjunctions (e.g., because, although, since, if, when, while, until) or relative pronouns (e.g., who, which, that). These words create a relationship of time, cause, condition, or contrast between the clauses.' },
        { type: 'text', body: 'Punctuation in complex sentences depends on the order of the clauses. If the dependent clause comes first, a comma separates it from the independent clause. If the independent clause comes first, usually no comma is needed (unless the dependent clause shows extreme contrast or begins with words like "although" or "even though").' },
        { type: 'example', body: '"Since you have finished your chores, you may play outside." (Comma used). "You may play outside since you have finished your chores." (No comma).' },
        { type: 'text', body: 'Complex sentences are vital for academic and professional writing because they allow writers to express nuanced relationships between ideas, subordinating less important information to the main point.' },
        { type: 'keyTerms', terms: [{ term: 'Dependent Clause: A clause that cannot stand alone. Subordinating Conjunction: Words like "because" or "when" that introduce dependent clauses. Relative Clause: A type of dependent clause starting with a relative pronoun.', def: 'See summary' }] },
        { type: 'summary', points: ['Complex sentences blend one independent clause with one or more dependent clauses. Recognizing subordinating conjunctions and applying correct punctuation based on clause order are key to mastering this structure.'] }
      ],
      }, quiz: [
        { type: 'mcq', q: 'Identify the complex sentence:', options: ['The sun shone brightly.', 'The sun shone brightly, and the birds sang.', 'Because the sun shone brightly, we went to the beach.', 'The bright sun and the singing birds made us happy.'], answer: 2, why: 'Option C contains a dependent clause (Because...) and an independent clause.' },
        { type: 'truefalse', q: 'A dependent clause can stand alone as a sentence if it is long enough.', answer: false, why: 'No matter the length, a dependent clause does not express a complete thought on its own.' },
        { type: 'fill', q: 'In the sentence "We will leave when the bell rings", the dependent clause is "{{when the bell rings}}".', answer: 'when the bell rings', why: 'It starts with the subordinating conjunction "when" and cannot stand alone.' },
        { type: 'mcq', q: 'Which word is a subordinating conjunction?', options: ['and', 'but', 'although', 'so'], answer: 2, why: '"Although" introduces a dependent clause.' },
        { type: 'multi', q: 'Select the complex sentences:', options: ['If it snows tomorrow, school will be canceled.', 'I like coffee, but my sister prefers tea.', 'The book that I am reading is fascinating.', 'He ran fast.'], answers: [0, 2], why: 'Option A has an "if" clause. Option C has a relative clause "that I am reading".' },
        { type: 'mcq', q: 'Identify the sentence type: "While you were sleeping, I cleaned the entire house."', options: ['Simple', 'Compound', 'Complex', 'Compound-Complex'], answer: 2, why: 'It has a dependent clause starting with "While" followed by an independent clause.' },
        { type: 'truefalse', q: 'You always need a comma when an independent clause is followed by a dependent clause.', answer: false, why: 'Usually, no comma is needed when the independent clause comes first, unless expressing contrast.' },
        { type: 'mcq', q: 'Choose the correct punctuation: "I brought an umbrella __ because the forecast predicted rain."', options: [',', ';', '.', '(no punctuation)'], answer: 3, why: 'When the independent clause precedes the dependent clause starting with "because", no comma is typically used.' },
        { type: 'fill', q: 'A complex sentence consists of one independent clause and at least one {{dependent}} clause.', answer: 'dependent', why: 'This is the definition of a complex sentence.' },
        { type: 'mcq', q: 'Which clause is the independent clause in this sentence: "After she finished the exam, Sarah felt relieved."', options: ['After she finished', 'the exam', 'Sarah felt relieved', 'After she finished the exam'], answer: 2, why: '"Sarah felt relieved" can stand alone as a complete thought.' },
        { type: 'multi', q: 'Which of the following start a dependent clause?', options: ['Therefore', 'Since', 'Unless', 'However'], answers: [1, 2], why: '"Since" and "Unless" are subordinating conjunctions. The others are conjunctive adverbs.' },
        { type: 'truefalse', q: 'Relative pronouns like "who" or "which" can introduce dependent clauses.', answer: true, why: 'Yes, they introduce relative clauses, which are a type of dependent clause.' },
        { type: 'mcq', q: 'Identify the sentence type: "The car, which was painted bright red, sped down the highway."', options: ['Simple', 'Compound', 'Complex', 'Compound-Complex'], answer: 2, why: 'It has an independent clause interrupted by a dependent relative clause ("which was painted...").' },
        { type: 'fill', q: 'Words like "although", "even though", and "while" are used to show {{contrast}} in a complex sentence.', answer: 'contrast', why: 'These subordinating conjunctions indicate a concession or contrasting relationship.' },
        { type: 'mcq', q: 'Why is this a complex sentence: "He is the man who saved my dog."?', options: ['It has two subjects.', 'It contains the coordinating conjunction "who".', 'It has an independent clause and a dependent relative clause.', 'It is actually a simple sentence.'], answer: 2, why: '"He is the man" is independent, and "who saved my dog" is a dependent relative clause.' }
      ] }
];



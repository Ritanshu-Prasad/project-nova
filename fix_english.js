const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

const engContent = {
  "eng-gen-1": {
    title: "Pronouns in Practice",
    simple: "Replacing nouns to avoid repetition.",
    text: "Pronouns are the ultimate shortcut in language. Without them, we would have to repeat names endlessly: 'Mary went to Mary's car because Mary forgot Mary's keys.' Instead, we use pronouns: 'Mary went to her car because she forgot her keys.' Examples include I, you, he, she, it, we, and they. But beware of ambiguous pronouns! If you write 'The dog chased the cat until it fell exhausted,' we don't know who 'it' refers to.",
    points: ["Pronouns replace nouns", "Avoid ambiguous references", "Case matters (he vs him)"],
    mcqQ: "Which sentence avoids an ambiguous pronoun?",
    mcqA: ["Sarah told Jane that Jane won the prize.", "Sarah told Jane that she won the prize.", "The car hit the wall and it broke.", "When the teachers met the students, they were happy."],
    mcqWhy: "Repeating the noun 'Jane' ensures there is no confusion about who won."
  },
  "eng-gen-2": {
    title: "Action and Linking Verbs",
    simple: "Verbs do more than just show action.",
    text: "While most verbs express action (run, jump, write), linking verbs connect the subject to more information about it. For example, in the sentence 'The soup smells delicious,' 'smells' is a linking verb connecting 'soup' to 'delicious.' It doesn't mean the soup has a nose and is sniffing! Common linking verbs include forms of 'to be' (is, am, are, was, were), seem, become, and feel.",
    points: ["Action verbs show doing", "Linking verbs connect states", "To be is the most common"],
    mcqQ: "Identify the linking verb in this sentence: 'The sky grew dark as the storm approached.'",
    mcqA: ["grew", "dark", "approached", "storm"],
    mcqWhy: "'Grew' links 'sky' to the adjective 'dark', indicating a change in state."
  },
  "eng-gen-3": {
    title: "Mastering Verb Tenses",
    simple: "Time travel using verbs.",
    text: "Verbs tell us not just what happened, but when. English relies on tense to indicate time. Simple past (I walked) means it's over. Present perfect (I have walked) means it happened in the past but is still relevant now. Past perfect (I had walked) is the 'past of the past'—useful for establishing order: 'I had already eaten by the time John arrived.' Using tenses consistently is the key to clear storytelling.",
    points: ["Simple tenses (past, present, future)", "Perfect tenses show completion", "Consistency is crucial"],
    mcqQ: "Which sentence correctly uses the past perfect tense?",
    mcqA: ["She had finished the report before the meeting started.", "She has finished the report yesterday.", "She finishes the report before the meeting.", "She finished the report and had left."],
    mcqWhy: "Past perfect ('had finished') happens before another past action ('started')."
  },
  "eng-gen-4": {
    title: "Adjectives: Painting with Words",
    simple: "Modifying nouns for vivid imagery.",
    text: "Adjectives describe or modify nouns and pronouns. Instead of saying 'a dog,' you might say 'a ferocious, foaming, giant dog.' Order matters in English adjectives. Native speakers instinctively use the order: opinion, size, age, shape, color, origin, material, purpose. This is why 'a beautiful little old French silver whittling knife' sounds perfectly natural, but 'a silver French beautiful little old whittling knife' sounds completely wrong.",
    points: ["Adjectives modify nouns", "Order of adjectives matters", "Use them sparingly for impact"],
    mcqQ: "Which phrase follows the natural order of English adjectives?",
    mcqA: ["A lovely little old wooden box", "A wooden little old lovely box", "An old lovely wooden little box", "A little lovely old wooden box"],
    mcqWhy: "Opinion (lovely) comes before size (little), age (old), and material (wooden)."
  },
  "eng-gen-5": {
    title: "Adverbs: How, When, Where",
    simple: "Modifying verbs, adjectives, and other adverbs.",
    text: "Adverbs modify verbs, adjectives, or even other adverbs. They answer questions like how (quickly), when (yesterday), where (everywhere), and to what extent (very). Example: 'He ran remarkably fast.' 'Fast' modifies the verb 'ran', making it an adverb, and 'remarkably' modifies 'fast', making it an adverb too. Beware of the common mistake: 'I did good on the test.' Good is an adjective. You should say, 'I did well on the test.'",
    points: ["Modify verbs and adjectives", "Often end in -ly", "Well vs. Good"],
    mcqQ: "In the sentence 'The incredibly talented musician played perfectly,' how many adverbs are there?",
    mcqA: ["Two", "One", "Three", "None"],
    mcqWhy: "'Incredibly' modifies 'talented' (adjective) and 'perfectly' modifies 'played' (verb)."
  },
  "eng-gen-6": {
    title: "Prepositional Phrases",
    simple: "Showing relationships in space and time.",
    text: "Prepositions tell you the relationship between a noun and another part of the sentence, often indicating space or time. Think of a preposition as anything a mouse can do to a log: it can go over, under, through, in, out, or around the log. The preposition combined with its noun is a 'prepositional phrase' (e.g., 'under the bed'). Avoid ending a sentence with a preposition if it sounds awkward, but don't force it—as Winston Churchill allegedly joked, 'This is the sort of English up with which I will not put.'",
    points: ["Indicate space and time", "Preposition + Object = Phrase", "Ending sentences with them is fine"],
    mcqQ: "Identify the prepositional phrase: 'The cat slept peacefully on the warm radiator.'",
    mcqA: ["on the warm radiator", "slept peacefully", "The cat slept", "peacefully on"],
    mcqWhy: "It starts with the preposition 'on' and ends with the noun 'radiator'."
  },
  "eng-gen-7": {
    title: "Conjunctions: The Glue",
    simple: "Joining words, phrases, and clauses.",
    text: "Conjunctions connect ideas. Coordinating conjunctions (FANBOYS: For, And, Nor, But, Or, Yet, So) connect equal parts: 'I wanted ice cream, but the shop was closed.' Subordinating conjunctions (because, although, if, since) connect an independent clause to a dependent clause: 'Because the shop was closed, I went home.' Using the right conjunction clarifies the logic between your thoughts.",
    points: ["FANBOYS for equal parts", "Subordinating for dependent parts", "Clarify logical relationships"],
    mcqQ: "Which word is a coordinating conjunction?",
    mcqA: ["But", "Although", "Because", "Since"],
    mcqWhy: "'But' is part of FANBOYS, used to connect independent clauses."
  },
  "eng-gen-8": {
    title: "Subjects: The 'Who' or 'What'",
    simple: "The star of the sentence.",
    text: "Every complete sentence must have a subject. The subject is the person, place, thing, or idea that is doing or being something. In 'The ancient, crumbling castle stood on the hill,' the simple subject is just 'castle,' while the complete subject is 'The ancient, crumbling castle.' Sometimes the subject is understood but not written, as in the command: 'Stop!' (The subject is an implied 'You').",
    points: ["The doer of the action", "Simple vs Complete subject", "Implied 'You' in commands"],
    mcqQ: "What is the simple subject in the sentence: 'A flock of wild geese flew overhead.'?",
    mcqA: ["flock", "geese", "flew", "A flock of wild geese"],
    mcqWhy: "'Flock' is the singular noun doing the flying; 'of wild geese' is a prepositional phrase describing it."
  },
  "eng-gen-9": {
    title: "Predicates: The Action",
    simple: "What the subject does or is.",
    text: "If the subject is the star, the predicate is what the star does. It contains the verb and everything following it that describes the action. In 'The dog buried his bone in the garden,' the complete predicate is 'buried his bone in the garden.' The simple predicate is just the verb: 'buried.' A sentence is not complete without a predicate, even if the subject is very long.",
    points: ["Contains the verb", "Describes the subject's action", "Cannot be omitted"],
    mcqQ: "What is the complete predicate in: 'The brave firefighter rescued the kitten.'?",
    mcqA: ["rescued the kitten", "rescued", "The brave firefighter rescued", "kitten"],
    mcqWhy: "It includes the verb 'rescued' and its object 'the kitten'."
  },
  "eng-gen-10": {
    title: "Independent Clauses",
    simple: "A complete thought.",
    text: "An independent clause has a subject, a verb, and expresses a complete thought. It can stand alone as a sentence. 'The sun sets.' is an independent clause. 'Although the sun sets' is not. When you write, you are stringing together independent clauses. You can join two of them using a semicolon or a comma with a coordinating conjunction (FANBOYS).",
    points: ["Subject + Verb + Complete Thought", "Can stand alone", "Joined by semicolons or FANBOYS"],
    mcqQ: "Which of the following is an independent clause?",
    mcqA: ["The dog barked loudly.", "Because the dog barked loudly.", "When the dog barked.", "Barking loudly at the mailman."],
    mcqWhy: "It has a subject (dog), verb (barked), and is a complete thought."
  },
  "eng-gen-11": {
    title: "Dependent Clauses",
    simple: "Needs help to stand up.",
    text: "A dependent clause has a subject and a verb, but it cannot stand alone because it begins with a subordinating word (like although, because, if, when, which). 'When the timer rings' leaves you hanging. It must be attached to an independent clause: 'When the timer rings, take the cake out.' Understanding this distinction is the secret to fixing sentence fragments.",
    points: ["Has subject and verb", "Starts with subordinating word", "Cannot stand alone"],
    mcqQ: "Identify the dependent clause: 'I will go to the park if it stops raining.'",
    mcqA: ["if it stops raining", "I will go", "to the park", "I will go to the park"],
    mcqWhy: "It starts with the subordinating conjunction 'if' and cannot stand alone."
  },
  "eng-gen-12": {
    title: "Simple and Compound Sentences",
    simple: "Sentence structures basics.",
    text: "A simple sentence consists of one independent clause: 'The ice melted.' A compound sentence joins two independent clauses using a conjunction or semicolon: 'The ice melted, and the water spilled.' Using a variety of simple and compound sentences gives your writing rhythm. Too many simple sentences sound choppy; too many compound sentences sound rambling.",
    points: ["Simple: 1 clause", "Compound: 2+ independent clauses", "Vary sentence lengths"],
    mcqQ: "What type of sentence is: 'She wanted to play outside, but it was raining.'?",
    mcqA: ["Compound", "Simple", "Complex", "Fragment"],
    mcqWhy: "It connects two independent clauses with the conjunction 'but'."
  },
  "eng-gen-13": {
    title: "Complex Sentences",
    simple: "Layering information.",
    text: "A complex sentence combines one independent clause with at least one dependent clause. 'Although she was tired (dependent), she finished her homework (independent).' If the dependent clause comes first, use a comma. If the independent clause comes first, you usually don't need a comma: 'She finished her homework although she was tired.'",
    points: ["1 Independent + 1+ Dependent", "Comma if dependent comes first", "Adds nuance to writing"],
    mcqQ: "Does this complex sentence need a comma: 'He bought the shoes because they were on sale.'?",
    mcqA: ["No comma needed", "Yes, before 'because'", "Yes, after 'because'", "Yes, after 'shoes'"],
    mcqWhy: "Because the independent clause comes first, no comma is needed before the dependent clause."
  },
  "eng-gen-14": {
    title: "Mastering the Comma",
    simple: "The breath of the sentence.",
    text: "Commas are often misused. Use them to separate items in a list (apples, oranges, and pears), to separate two independent clauses with a conjunction, or after an introductory dependent clause. Do NOT use a comma just because you would take a breath while speaking. The 'comma splice' is a fatal error: joining two complete sentences with only a comma ('I went home, I was tired').",
    points: ["Lists and introductions", "FANBOYS joining complete sentences", "Beware the comma splice"],
    mcqQ: "Which sentence contains a comma splice error?",
    mcqA: ["The wind blew fiercely, the trees shook.", "The wind blew fiercely, and the trees shook.", "Because the wind blew fiercely, the trees shook.", "The wind blew fiercely; the trees shook."],
    mcqWhy: "It illegally joins two complete sentences with just a comma."
  },
  "eng-gen-15": {
    title: "The Colon",
    simple: "The drumroll.",
    text: "A colon is a drumroll: it introduces something important that follows from what was just said. It can introduce a list, a quote, or an explanation. Crucially, the text before the colon must be a complete independent sentence. CORRECT: 'I have three favorite colors: red, blue, and green.' INCORRECT: 'My favorite colors are: red, blue, and green.' (Because 'My favorite colors are' is not a complete sentence).",
    points: ["Acts as a drumroll", "Must follow an independent clause", "Introduces lists or explanations"],
    mcqQ: "Which sentence uses a colon correctly?",
    mcqA: ["He had one rule: never look back.", "She bought: apples, milk, and bread.", "The best team is: the Eagles.", "Such as: cats, dogs, and birds."],
    mcqWhy: "'He had one rule' is a complete sentence introducing an explanation."
  },
  "eng-gen-16": {
    title: "The Em Dash",
    simple: "The dramatic pause.",
    text: "The em dash (—) is the versatile bad boy of punctuation. It can replace commas for a more dramatic parenthetical thought, replace a colon for emphasis, or indicate an abrupt change in thought. 'The pie—which was supposed to be cherry—was filled with meat.' It adds a highly stylized, punchy rhythm to your writing. Just don't overuse it, or your writing will feel frantic.",
    points: ["Adds dramatic emphasis", "Can replace commas or colons", "Use sparingly for impact"],
    mcqQ: "What is the primary effect of using an em dash instead of commas?",
    mcqA: ["It adds dramatic emphasis or abruptness.", "It makes the sentence grammatically formal.", "It changes the tense of the verb.", "It turns an independent clause into a dependent one."],
    mcqWhy: "Em dashes disrupt the flow visually to emphasize the enclosed text."
  },
  "eng-gen-17": {
    title: "Fixing Run-On Sentences",
    simple: "Knowing when to stop.",
    text: "A run-on sentence isn't just a long sentence; it's a grammatical failure where two independent clauses are mashed together without proper punctuation. 'I drove to the store I bought milk.' This is a fused sentence. You can fix it with a period ('store. I'), a semicolon ('store; I'), or a conjunction with a comma ('store, and I'). A 100-word sentence can be grammatically perfect, while a 5-word sentence can be a run-on.",
    points: ["Not about length", "Missing punctuation between clauses", "Fix with periods or semicolons"],
    mcqQ: "How can you fix this run-on: 'The alarm rang she woke up.'?",
    mcqA: ["The alarm rang; she woke up.", "The alarm rang she, woke up.", "The alarm, rang she woke up.", "The alarm rang she woke, up."],
    mcqWhy: "A semicolon properly separates two closely related independent clauses."
  },
  "eng-gen-18": {
    title: "Avoiding Sentence Fragments",
    simple: "Missing the core components.",
    text: "A fragment is a piece of a sentence pretending to be a whole one. It is usually missing a subject or a verb, or it's a dependent clause masquerading as an independent one. Example: 'Walking through the dark forest.' Who is walking? What happened? The sentence is incomplete. Fix it by attaching it to a real sentence: 'Walking through the dark forest, the knight drew his sword.'",
    points: ["Missing subject or verb", "Or is a lone dependent clause", "Fix by combining sentences"],
    mcqQ: "Which of the following is a sentence fragment?",
    mcqA: ["Because the bridge collapsed during the storm.", "The bridge collapsed during the storm.", "They closed the bridge.", "Storms collapse bridges."],
    mcqWhy: "It starts with 'Because', making it a dependent clause that needs an independent clause to finish the thought."
  },
  "eng-gen-19": {
    title: "Passive Voice Pitfalls",
    simple: "Who is doing what?",
    text: "In the active voice, the subject performs the action: 'The dog bit the man.' In the passive voice, the subject receives the action: 'The man was bitten by the dog.' Passive voice often requires more words and obscures responsibility ('Mistakes were made' vs 'I made mistakes'). While passive voice isn't strictly grammatically incorrect, relying on active voice makes your writing punchier, clearer, and more direct.",
    points: ["Active: Subject acts", "Passive: Subject is acted upon", "Active is usually clearer"],
    mcqQ: "Identify the sentence written in the active voice:",
    mcqA: ["The chef cooked a delicious meal.", "A delicious meal was cooked by the chef.", "The meal was cooked quickly.", "The meal had been cooked."],
    mcqWhy: "The subject (chef) is performing the action (cooked)."
  },
  "eng-gen-20": {
    title: "Paragraph Transitions",
    simple: "Bridging your thoughts.",
    text: "Even if every sentence is grammatically perfect, your writing will fail if the ideas don't connect. Transitions are the bridges between paragraphs. Instead of jumping from a paragraph about apples directly into a paragraph about oranges, a transition sentence eases the reader in: 'While apples offer a crisp sweetness, citrus fruits like oranges provide an entirely different nutritional profile.' Use transitional adverbs like however, furthermore, or conversely.",
    points: ["Connect disparate ideas", "Guide the reader's logic", "Use transitional phrases"],
    mcqQ: "Which word is best used to show a contrast between two paragraphs?",
    mcqA: ["Conversely", "Furthermore", "Additionally", "Consequently"],
    mcqWhy: "'Conversely' indicates that the following idea is opposite or contrasting to the previous one."
  },
  "eng-gen-21": {
    title: "The Art of Editing",
    simple: "Writing is rewriting.",
    text: "Great writing doesn't happen on the first draft. The art of editing involves mercilessly cutting filler words (very, really, just, that), replacing weak adjectives with strong verbs, and reading your work aloud to catch awkward rhythms. If a sentence requires the reader to re-read it twice to understand it, the sentence is broken. Your goal is frictionless transfer of thought from your brain to the reader's.",
    points: ["Cut filler words", "Prioritize strong verbs", "Read aloud for rhythm"],
    mcqQ: "What is a highly effective technique for catching awkward phrasing during editing?",
    mcqA: ["Reading the text aloud.", "Running a spellchecker.", "Changing the font size.", "Adding more adjectives."],
    mcqWhy: "Reading aloud engages your ear, quickly revealing unnatural rhythms and clunky phrasing."
  }
};

let matchCount = 0;

for (const [id, t] of Object.entries(engContent)) {
  const regex = new RegExp(`topic\\('${id}'[\\s\\S]*?\\\]\\)`);
  
  const replacement = `topic('${id}', '${t.title.replace(/'/g, "\\'")}', 'Lexis', 'concept', '${t.simple.replace(/'/g, "\\'")}', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: '${t.simple.replace(/'/g, "\\'")}',
    blocks: [
      { type: 'text', body: '${t.text.replace(/'/g, "\\'")}' },
      { type: 'summary', points: ['${t.points.join("', '")}'] }
    ]
  }, [
    mcq('${t.mcqQ.replace(/'/g, "\\'")}', ['${t.mcqA.join("', '")}'], '${t.mcqWhy.replace(/'/g, "\\'")}'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ])`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    matchCount++;
  }
}

fs.writeFileSync(file, code);
console.log('Fixed ' + matchCount + ' English topics!');

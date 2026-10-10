import type { TopicContent } from './types';

/** Advanced React Patterns — modules 1–5: in-depth lessons, lesson quizzes and practice pools. */
export const react1Content: Record<string, TopicContent> = {
  'react-gen-1': {
    summary: 'React treats the screen as a pure function of state: you describe the UI for each state and React updates the page.',
    lesson: {
      minutes: 8,
      objectives: [
        'Explain why UI = f(state) is called declarative and how it differs from imperative DOM code',
        'Predict what a simple component renders for a given props and state',
        'Break a design into a component hierarchy and decide which component should own each piece of state',
        'Distinguish props from state and explain one-way data flow',
      ],
      simple:
        'In React you do not tell the browser which element to change. You write a function that says what the screen should look like for the current data, and React works out the changes. When the data changes, the function runs again and the screen follows.',
      blocks: [
        {
          type: 'text',
          title: 'Why React exists',
          body:
            'Think of a cricket scoreboard app. Runs, wickets, overs and the batter’s name all change many times a minute. If you update each piece by hand, you must remember every place that shows the score. Miss one and the screen lies. React removes that burden. You describe what the screen looks like for the *current* data, and React makes the page match. This idea is written as UI = f(state): the user interface is a function of state. State means the data that can change over time and affects what is shown.',
        },
        {
          type: 'analogy',
          body:
            'A restaurant order. In imperative style you walk into the kitchen and tell the cook each step: chop onions, heat oil, add the onions. In declarative style you hand over a menu order, “one masala dosa”, and the kitchen decides how to produce it. React is the kitchen. You write the order (the UI for a state); React does the cooking (the DOM changes).',
        },
        {
          type: 'text',
          title: 'Imperative versus declarative',
          body:
            'The DOM (Document Object Model) is the browser’s live tree of page elements. Imperative code edits it step by step: find this element, change its text, add that class, remove this child. Declarative code only describes the result. The code below shows both for a like button. In the imperative version you must keep the number and the label in sync yourself, and every new feature adds more steps to remember. In the React version there is exactly one source of truth, the likes variable, and the JSX (the HTML-like syntax React uses) is written once.',
        },
        {
          type: 'code',
          language: 'javascript',
          code: `// Imperative: you manage every DOM change yourself
let likes = 0;
const btn = document.querySelector('#like');
btn.addEventListener('click', () => {
  likes += 1;
  btn.textContent = 'Likes: ' + likes;
  if (likes >= 10) btn.classList.add('popular');
});`,
          caption:
            'Plain JavaScript. After each click you must update the text and the class manually. Forget one line and the page and the data disagree.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `import { useState } from 'react';

function LikeButton() {
  const [likes, setLikes] = useState(0);
  return (
    <button
      className={likes >= 10 ? 'popular' : ''}
      onClick={() => setLikes(likes + 1)}
    >
      Likes: {likes}
    </button>
  );
}`,
          caption:
            'Declarative. useState returns the current value (likes) and a setter (setLikes). The JSX describes the button for any value of likes. Calling setLikes makes React run LikeButton again and update only what changed.',
        },
        {
          type: 'text',
          title: 'Components, props and one-way data flow',
          body:
            'A component is a function that returns JSX. Components nest like folders: a ScoreBoard contains a Team, which contains a PlayerRow. Data moves *down* the tree through props, short for properties, which are the inputs a parent passes to a child, like function arguments. A child must never change its props. If the child needs to ask for a change, the parent passes down a function, and the child calls it. This is called one-way data flow, and it makes bugs easy to trace because data has only one direction to travel. Rendering should also be pure: the same props and state must always give the same JSX, with no side effects such as changing outside variables while rendering.',
        },
        {
          type: 'text',
          title: 'The five steps of thinking in React',
          body:
            'React’s own guide suggests a routine for any design. First, draw boxes around the pieces of the mock-up and name each one; each box becomes a component. Second, build a static version using only props, with no state. Third, decide the minimal state: the smallest set of data that changes. Anything you can calculate from other data is not state. Fourth, decide which component owns each piece of state; it should be the closest common parent of every component that needs it. Fifth, add inverse data flow: pass setter functions down so children can request changes.',
        },
        {
          type: 'example',
          title: 'Worked example: a searchable fruit list',
          body:
            'Design: a text box above a list of fruits (Mango, Guava, Papaya, Banana). Typing “an” should show only Mango and Banana. Step 1: components are FruitSearch (the whole thing), SearchBox and FruitList. Step 2: build them statically with a hard-coded fruits array. Step 3: what is state? The search text changes, so it is state. The filtered list can be computed from the fruits and the text, so it is NOT state. Step 4: both SearchBox (shows the text) and FruitList (needs the text to filter) need it, so their closest common parent, FruitSearch, owns it. Step 5: FruitSearch passes text and setText to SearchBox. Typing “an” calls setText(‘an’), React runs FruitSearch again, the list is filtered to Mango and Banana and the screen updates.',
        },
        {
          type: 'compare',
          title: 'Props versus state',
          columns: ['Props', 'State'],
          rows: [
            ['Who owns it', 'The parent that renders the component', 'The component itself'],
            ['Can the component change it?', 'No, read-only', 'Yes, through the setter function'],
            ['Typical use', 'Configuration such as a title or a callback', 'Data that changes, such as input text or a counter'],
            ['Change triggers a re-render', 'When the parent passes new values', 'When the setter is called with a new value'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Declarative UI', def: 'Describing what the screen should look like for a state, not the steps to change it.' },
            { term: 'State', def: 'Data owned by a component that changes over time and affects what it renders.' },
            { term: 'Props', def: 'Read-only inputs a parent passes to a child component.' },
            { term: 'One-way data flow', def: 'Data travels down the tree through props; changes are requested through callbacks.' },
            { term: 'Pure rendering', def: 'The same props and state always produce the same JSX, with no side effects during render.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'A common mistake is storing derived data in state, such as a filteredFruits array next to the original fruits and the search text. The two copies drift apart. Calculate it during render instead.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body:
            'React was first used on Facebook’s news feed around 2011 and open-sourced in 2013. Its core promise, UI as a function of state, has stayed the same through hooks (2019) and React 18 and 19.',
        },
        {
          type: 'summary',
          points: [
            'UI = f(state): you describe the screen for the current data and React updates the DOM.',
            'Declarative code removes the need to keep several DOM updates in sync by hand.',
            'Props flow down and are read-only; state is owned by a component and changed through its setter.',
            'Keep state minimal, compute everything else during render, and place state in the closest common parent.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A developer writes: const [count, setCount] = useState(0); and a button with onClick={() => setCount(count + 1)} that shows “Clicked {count} times”. After three clicks, why does the text read “Clicked 3 times”?',
        options: [
          'React re-runs the component with the new state and updates the text to match',
          'React finds the text node in the DOM and increments it by one each time',
          'The setter edits the JSX string stored inside the component function',
          'The browser re-renders the whole page from the server after each click',
        ],
        answer: 0,
        why: 'Calling the setter schedules a re-render. The component function runs again with count = 3 and React updates only the text that changed. Nothing is edited by hand.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A ScoreBoard component holds the list of players. Both PlayerList and a TotalRuns header need the same list and both must update when a run is scored. Where should the list live?',
        options: [
          'In PlayerList, with TotalRuns reading it through the DOM',
          'In ScoreBoard, passed down to both as props',
          'In a separate copy inside each of the two children',
          'In a global variable that both components mutate directly',
        ],
        answer: 1,
        why: 'State belongs in the closest common parent of the components that need it. Duplicate copies drift apart, and mutating a global variable does not trigger re-renders.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Given const [text, setText] = useState(\'\'); and const shown = fruits.filter(f => f.includes(text));, which statement about shown is correct?',
        options: [
          'It must also be stored with useState so React can track it',
          'It should be updated inside an onChange handler with setShown',
          'It is derived data, so compute it during render and keep it out of state',
          'It must be wrapped in useEffect or the list will never update',
        ],
        answer: 2,
        why: 'Anything that can be calculated from existing state or props is derived data. Storing it separately creates two sources of truth that can disagree.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are features of a declarative React component?',
        options: [
          'It describes the UI for a given state',
          'It calls document.querySelector to update text after each change',
          'The same props and state give the same JSX',
          'React decides which DOM changes are needed',
          'The component must change its props to signal the parent',
        ],
        answers: [0, 2, 3],
        why: 'Declarative components describe the result and React works out the changes. Hand-written DOM queries are imperative, and props are read-only.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In React, a child component is allowed to change the props it receives, as long as it then calls setState.',
        answer: false,
        why: 'Props are read-only. To request a change, the child calls a function the parent passed down, and the parent updates its own state.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'The idea that a React screen is a function of the current data is often written as UI = f(____).',
        answer: 'state',
        accept: ['State', 'props and state'],
        why: 'UI = f(state): for any state, the function returns the same UI, which makes the screen predictable.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put the five steps of “thinking in React” in order.',
        items: [
          'Break the mock-up into a component hierarchy',
          'Build a static version with props only',
          'Find the minimal state',
          'Decide which component owns the state',
          'Add inverse data flow with callback props',
        ],
        why: 'You first see the pieces, then render them statically, then add state, place it, and finally let children request changes.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write a Greeting component that takes a name prop and renders it inside an h1 as “Hello, <name>!”.',
        language: 'tsx',
        starter: 'function Greeting({ name }: { name: string }) {\n  return (\n    \n  );\n}',
        solution: 'function Greeting({ name }: { name: string }) {\n  return <h1>Hello, {name}!</h1>;\n}',
        checks: [
          { label: 'Renders an h1', pattern: String.raw`<h1[^>]*>` },
          { label: 'Contains the Hello text', pattern: String.raw`Hello,\s*` },
          { label: 'Interpolates name in braces', pattern: String.raw`\{\s*(props\.)?name\s*\}` },
        ],
        why: 'The component is a function from props to JSX. The curly braces insert the value of name into the markup.',
        difficulty: 1,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'This component shows a stale total after the user adds an item:\nconst [items, setItems] = useState([]);\nconst [total, setTotal] = useState(0);\nOn add: setItems([...items, x]); but setTotal is never called. What is the best fix?',
        options: [
          'Call setTotal inside a setTimeout so that it runs a little after each add',
          'Remove total from state and compute items.length during render',
          'Store total in a global variable and update that variable after each add',
          'Call location.reload() to refresh the page after each add so total updates',
        ],
        answer: 1,
        why: 'The total is derived from items, so it should not be state at all. Computing it during render means it can never be out of sync.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'What does this component render when count is 2?\nfunction Badge({ count }) {\n  return <span>{count > 0 ? count + \' new\' : \'none\'}</span>;\n}',
        options: ['none', '2', '2 new', 'count new'],
        answer: 2,
        why: 'count > 0 is true for 2, so the expression gives the string “2 new”. The braces evaluate a JavaScript expression inside JSX.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A learner builds a static version of a page and wants to add interactivity. Which data is a good candidate for state?',
        options: [
          'The full name, built by joining firstName and lastName state values',
          'The number of words in an essay, computed from the text state',
          'The text typed in a search box, which changes as the user types',
          'The CSS class that is chosen from an existing boolean state',
        ],
        answer: 2,
        why: 'Typed text cannot be computed from anything else, so it is real state. Full name, word count and the CSS class can all be calculated from existing values.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Why does a React component that increments a variable declared with let during render, such as let renders = 0; renders++; inside the function body, break the “pure rendering” rule?',
        options: [
          'Because variables declared with let cannot be used inside component functions',
          'Because the extra assignment makes React skip the next update of the tree',
          'Because the variable is reset to zero only when the page runs on the server',
          'Because render should give the same output for the same inputs, with no side effects',
        ],
        answer: 3,
        why: 'Render must be a pure calculation. Changing outside state during render makes the result depend on how often React happens to call the function.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A parent passes onSave={() => save(data)} to a child form. When the user clicks Save, the child calls onSave(). Which idea does this illustrate?',
        options: [
          'Inverse data flow: children request changes through callbacks from the parent',
          'Two-way data binding, where the child writes straight into the parent’s state object',
          'The child mutating the parent’s props directly',
          'Lifting the DOM node up into the parent component',
        ],
        answer: 0,
        why: 'Data flows down through props, but a function passed as a prop lets a child signal upwards, while the parent still owns the change.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'An imperative script updates a cart badge in three different places after adding an item, and a developer forgets one. Which React property prevents this class of bug?',
        options: [
          'The UI is described once as a function of state, so every place re-renders from the same data',
          'React keeps a copy of the DOM in memory, so manual badge updates can never go out of date',
          'React forbids more than one element from showing the same number, so duplicates are removed',
          'React always reloads the whole page after a state change, which refreshes every badge at once',
        ],
        answer: 0,
        why: 'With one source of truth in state, each display is calculated from the same data on every render, so they cannot disagree.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'A design shows a product list with a category dropdown and a “show only in-stock” checkbox. Which of these are minimal state?',
        options: [
          'The selected category',
          'The in-stock checkbox value',
          'The filtered list shown on screen',
          'The count of visible products',
        ],
        answers: [0, 1],
        why: 'The selected category and checkbox cannot be derived. The filtered list and its count are computed from them and the product data.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these statements about props and state are true?',
        options: [
          'Props are passed from a parent to a child',
          'State is owned by the component that declares it',
          'A component can assign a new value to its own props',
          'Changing state through its setter triggers a re-render',
        ],
        answers: [0, 1, 3],
        why: 'Props come from above and are read-only, whereas state belongs to the component and its setter schedules a re-render.',
        difficulty: 1,
      },
      {
        type: 'truefalse',
        q: 'A component that keeps both a fruits array and a filteredFruits array in state, updating filteredFruits in the search handler, follows the “minimal state” advice.',
        answer: false,
        why: 'filteredFruits can be calculated from fruits and the search text, so keeping it in state creates duplicated data that can fall out of sync.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In React, data moves down the tree through ____, which child components must treat as read-only.',
        answer: 'props',
        accept: ['properties', 'Props'],
        why: 'Props are the inputs a parent passes down. Treating them as read-only keeps data flow one-way and predictable.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each approach to its description.',
        pairs: [
          ['Imperative', 'You write the steps that change the DOM'],
          ['Declarative', 'You describe the UI for a given state'],
          ['Derived data', 'A value calculated from other state or props'],
          ['Inverse data flow', 'A child calls a parent’s callback to request a change'],
        ],
        why: 'These four terms are the vocabulary of thinking in React: declare the result, avoid duplicated data, and let children talk up with callbacks.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which description of a React component is most accurate for function Price({ amount }) { return <p>₹{amount * 1.18}</p>; } given amount = 100?',
        options: [
          'It renders ₹118 and recalculates only when props change or the parent re-renders',
          'It renders ₹100 because props are read-only and cannot be used in arithmetic expressions',
          'It stores 118 in state the first time it is called and never recomputes it afterwards',
          'It edits the DOM node’s textContent once on mount',
        ],
        answer: 0,
        why: 'The JSX is an expression of props, giving 100 × 1.18 = 118. No state or DOM mutation is needed: the output follows from the input.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-2': {
    summary: 'JSX is HTML-like syntax that compiles to plain function calls, letting you embed JavaScript expressions in markup.',
    lesson: {
      minutes: 8,
      objectives: [
        'Convert a small piece of JSX into the equivalent createElement call and describe the object it returns',
        'Embed JavaScript expressions in JSX and tell expressions apart from statements',
        'Apply JSX rules: className, camelCase attributes, one root element, capitalised component names',
        'Render lists and conditional content correctly, including the 0 && pitfall',
      ],
      simple:
        'JSX lets you write markup that looks like HTML inside your JavaScript. A tool turns each tag into an ordinary function call, so it is just JavaScript underneath. Anything inside curly braces is a JavaScript expression whose result is shown on the screen.',
      blocks: [
        {
          type: 'text',
          title: 'What JSX is',
          body:
            'Before JSX, building a UI in JavaScript meant long nested function calls. JSX (JavaScript XML) is a syntax extension that lets you write tags directly in your code. Browsers do not understand it. A build tool such as Babel, SWC or esbuild compiles each tag into a function call before the code runs. So JSX is not a template language and not HTML; it is JavaScript with a friendlier way of writing nested calls. In a Vite or Next.js project this compile step is already set up for you.',
        },
        {
          type: 'analogy',
          body:
            'JSX is like shorthand handwriting. When you write “w/” for “with”, the meaning is identical; it is only quicker to write and read. A compiler expands the shorthand tags into the full function calls that JavaScript can actually run.',
        },
        {
          type: 'text',
          title: 'What the compiler produces',
          body:
            'Each JSX tag becomes a call that creates an *element*: a small plain object describing what to put on the screen, with a type, props and children. Classic React used React.createElement(type, props, ...children). Since React 17 the compiler uses a jsx() function from the react/jsx-runtime module, which means you no longer need to import React in every file. The result is the same idea. An element is cheap to create and is not a real DOM node; React reads these objects to decide what to draw. The next module explains how.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `// What you write
const el = <h1 className="title">Hello, {name}!</h1>;

// What the classic compiler produces
const el2 = React.createElement(
  'h1',
  { className: 'title' },
  'Hello, ', name, '!'
);

// What React receives (simplified)
// { type: 'h1',
//   props: { className: 'title', children: ['Hello, ', name, '!'] } }`,
          caption:
            'The JSX tag h1 becomes the string type "h1". Attributes become the props object. Everything between the tags becomes the children. The final object is a plain description, not a DOM node.',
        },
        {
          type: 'text',
          title: 'Curly braces: expressions only',
          body:
            'Inside JSX, curly braces open a window back into JavaScript. You can place any *expression*, meaning code that produces a value: a variable, a calculation, a function call, a ternary, or an array. You cannot place a *statement* such as if, for or a variable declaration, because statements do not produce values. To branch, use a ternary (cond ? a : b) or the && operator. To loop, use array.map(). You can use braces for text (Hello, {name}) and for attribute values (src={user.photo}). Strings in quotes are fixed text; braces are computed values.',
        },
        {
          type: 'text',
          title: 'The rules that trip people up',
          body:
            'A component must return one root element, so wrap siblings in a parent or in a Fragment, written <>...</> (an invisible wrapper that adds nothing to the DOM). Every tag must be closed, so use <img /> and <input />. Names that start with a lowercase letter are treated as built-in HTML tags; names starting with a capital letter are treated as components, so <Card /> works and <card /> does not. Because class and for are reserved words in JavaScript, use className and htmlFor. Most other attributes are camelCase, for example onClick and tabIndex. The style prop takes an object, not a string: style={ { color: \'red\', fontSize: 16 } }. The outer braces open a JSX expression and the inner braces are the object literal.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `type Task = { id: number; title: string; done: boolean };

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <>
      <h2>Tasks ({tasks.length})</h2>
      {tasks.length === 0 && <p>Nothing to do.</p>}
      <ul>
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            {t.title}
          </li>
        ))}
      </ul>
    </>
  );
}`,
          caption:
            'The Fragment <>…</> lets the component return two siblings. tasks.length is an expression inside the heading. The && line shows the paragraph only when the array is empty. map turns each task into an li, and key={t.id} gives React a stable identity for each item. The ternary chooses the class name.',
        },
        {
          type: 'example',
          title: 'Worked example: predicting the output',
          body:
            'Suppose tasks = [{id: 1, title: \'Buy milk\', done: true}, {id: 2, title: \'Pay bill\', done: false}]. The heading shows “Tasks (2)”. tasks.length === 0 is false, and false && <p>…</p> evaluates to false, which React renders as nothing. map returns two li elements: the first has className “done” and the text “Buy milk”; the second has className “” and the text “Pay bill”. Now suppose tasks is []. The heading shows “Tasks (0)”, the paragraph “Nothing to do.” appears, and the list is empty. If you had written {tasks.length && <p>…</p>} instead, then with an empty array tasks.length is 0, and React would render the number 0 on screen. Booleans, null and undefined render nothing, but the number 0 does render.',
        },
        {
          type: 'compare',
          title: 'JSX versus HTML',
          columns: ['HTML', 'JSX'],
          rows: [
            ['CSS class', 'class="box"', 'className="box"'],
            ['Label target', 'for="email"', 'htmlFor="email"'],
            ['Event handler', 'onclick="save()"', 'onClick={save}'],
            ['Inline style', 'style="color: red"', 'style={ { color: \'red\' } }'],
            ['Void tags', '<br> is allowed', '<br /> must be closed'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'JSX', def: 'A syntax extension that lets you write HTML-like tags that compile to JavaScript function calls.' },
            { term: 'React element', def: 'A plain object with a type, props and children that describes what to render.' },
            { term: 'Expression', def: 'Code that produces a value; only expressions are allowed inside JSX curly braces.' },
            { term: 'Fragment', def: 'The <>…</> wrapper that groups siblings without adding a DOM node.' },
            { term: 'key', def: 'A special prop that gives list items a stable identity between renders.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Avoid {count && <Badge />} when count can be 0, because React will print 0. Write {count > 0 && <Badge />} or use a ternary that returns null.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body:
            'JSX escapes text you embed in braces, so {userInput} cannot inject a script tag. Avoid dangerouslySetInnerHTML unless the HTML is sanitised first.',
        },
        {
          type: 'summary',
          points: [
            'JSX is syntax sugar: each tag compiles to createElement or jsx(), returning a plain element object.',
            'Curly braces accept expressions only; use ternaries, && and map instead of if and for.',
            'Use className, htmlFor, camelCase events, object styles, closed tags and a single root or Fragment.',
            'Lists need a stable key, and {0 && …} renders the number 0, so compare explicitly.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'What does the JSX <button disabled>Save</button> compile to with the classic transform?',
        options: [
          'document.createElement(\'button\', \'Save\')',
          'new Button({ disabled: true }, \'Save\')',
          'React.createElement(\'button\', { disabled: true }, \'Save\')',
          'React.render(\'button\', \'Save\', { disabled: true })',
        ],
        answer: 2,
        why: 'JSX compiles to createElement(type, props, ...children). A bare disabled attribute becomes disabled: true. It does not create a DOM node directly.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A learner writes: <p>{ if (isAdmin) { \'Admin\' } else { \'User\' } }</p>. Why does it fail, and what is the fix?',
        options: [
          'if is a statement, so use {isAdmin ? \'Admin\' : \'User\'}',
          'JSX needs else-if chains to be written in separate files',
          'Strings must be wrapped in backticks inside JSX braces',
          'Components cannot know about isAdmin without useEffect',
        ],
        answer: 0,
        why: 'Curly braces accept expressions that produce a value. if is a statement, but the ternary operator is an expression, so it works.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A component renders {items.length && <List items={items} />}. When items is an empty array, what appears on screen?',
        options: [
          'Nothing, because the empty list is falsy',
          'The number 0',
          'The text “false”',
          'An error saying List needs a key',
        ],
        answer: 1,
        why: 'items.length is 0, and 0 && x evaluates to 0. React renders numbers, including 0, although it skips false, null and undefined.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these JSX snippets are valid in a React component?',
        options: [
          '<div className="box" />',
          '<label htmlFor="name">Name</label>',
          '<img src={url}>',
          '<input type="text" />',
          '<div style="color: red" />',
        ],
        answers: [0, 1, 3],
        why: 'className, htmlFor and self-closing input are correct. A bare <img> tag is not closed, and style must be an object, not a string.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'JSX is not understood by browsers directly; a build tool such as Babel or SWC compiles it into JavaScript function calls first.',
        answer: true,
        why: 'Browsers only run JavaScript. The compiler rewrites every tag into createElement or jsx() calls before the code is executed.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'A component that returns two sibling elements without adding an extra DOM node should wrap them in a ____, written <>…</>.',
        answer: 'Fragment',
        accept: ['fragment', 'React.Fragment', 'React fragment'],
        why: 'A Fragment groups siblings so the component still returns one root, while adding nothing to the DOM.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which tag will React treat as a custom component rather than a built-in HTML element?',
        options: ['<profile_card />', '<profile-card />', '<profile card />', '<ProfileCard />'],
        answer: 3,
        why: 'JSX treats lowercase names as built-in tags and names starting with a capital letter as component references. Hence only ProfileCard calls your function.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Given an array names of strings, write a component NameList that renders a ul with one li per name, using the name itself as the key.',
        language: 'tsx',
        starter: 'function NameList({ names }: { names: string[] }) {\n  return (\n    <ul>\n      \n    </ul>\n  );\n}',
        solution: 'function NameList({ names }: { names: string[] }) {\n  return (\n    <ul>\n      {names.map((n) => (\n        <li key={n}>{n}</li>\n      ))}\n    </ul>\n  );\n}',
        checks: [
          { label: 'Uses map on names', pattern: String.raw`names\s*\.map\s*\(` },
          { label: 'Renders an li', pattern: String.raw`<li\b` },
          { label: 'Sets a key prop', pattern: String.raw`key\s*=\s*\{` },
        ],
        why: 'Lists are rendered by mapping data to elements. Each element needs a key so React can track it between renders.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'What does this component render?\nfunction Temp({ c }) {\n  return <p>{c}°C = {c * 9 / 5 + 32}°F</p>;\n}\nwith <Temp c={100} />',
        options: ['100°C = 100°F', '100°C = 212°F', '100°C = 132°F', 'It fails because arithmetic is not allowed in JSX'],
        answer: 1,
        why: 'Braces accept any expression: 100 × 9 ÷ 5 + 32 = 212. Arithmetic is fine in JSX.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A developer writes <div class="card">Hi</div> in a React component. What is the most likely result?',
        options: [
          'It renders class="card" but React logs a development warning to use className',
          'It renders normally and React gives no warning in development at all',
          'The compiler throws a syntax error and the project does not build',
          'React silently changes class to className and removes the attribute',
        ],
        answer: 0,
        why: 'React passes class through to the DOM, so it still renders, but it logs a dev warning because the JSX/DOM property name is className. Always write className.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which JSX renders the text “Hello” in red?',
        options: [
          '<p style="color: red">Hello</p>',
          '<p style={ { color: \'red\' } }>Hello</p>',
          '<p style={color: \'red\'}>Hello</p>',
          '<p css={ { color: \'red\' } }>Hello</p>',
        ],
        answer: 1,
        why: 'The style prop takes a JavaScript object. The outer braces open an expression and the inner braces are the object literal.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A component returns <h1>Title</h1><p>Body</p> directly with no wrapper. What happens, and what is the best fix?',
        options: [
          'It works; React renders both siblings automatically',
          'It errors because there are two roots; wrap them in a Fragment <>…</>',
          'It renders only the first element; add a key to the second',
          'It errors; wrap both in a div, since Fragments are not allowed in components',
        ],
        answer: 1,
        why: 'A component can return only one root expression. A Fragment solves it without adding an extra div to the DOM.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'What does {unread > 0 && <Badge n={unread} />} render when unread is 0?',
        options: ['The number 0', 'The text “false”', 'A Badge with n = 0', 'Nothing'],
        answer: 3,
        why: 'unread > 0 is the boolean false, so the expression is false, which React renders as nothing. Comparing explicitly avoids the bare-number pitfall.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A learner embeds user-typed text: <p>{comment}</p> where comment = "<img src=x onerror=alert(1)>". What appears?',
        options: [
          'The text is shown literally, because React escapes embedded strings',
          'An image tag is created and the alert runs',
          'The page crashes with a syntax error',
          'The text is removed because React strips every tag from embedded strings',
        ],
        answer: 0,
        why: 'React escapes values embedded through braces and shows them as text, which prevents most cross-site scripting. Only dangerouslySetInnerHTML bypasses this.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'Which of these can be placed directly inside JSX curly braces?',
        options: [
          'A function call such as formatDate(d)',
          'A ternary such as ok ? \'Yes\' : \'No\'',
          'A for loop that pushes list items',
          'A variable name such as total',
        ],
        answers: [0, 1, 3],
        why: 'Braces take expressions that produce values. A for loop is a statement; use map to produce an array instead.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which statements about the object produced by <Card title="A" /> are true?',
        options: [
          'It is a plain JavaScript object describing what to render',
          'Its props include title: "A"',
          'It is a real DOM node already attached to the page',
          'It is created cheaply on every render',
        ],
        answers: [0, 1, 3],
        why: 'A React element is a lightweight description with type and props. It is not a DOM node, which is why creating many of them each render is cheap.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Since React 17, the new JSX transform means a file that only contains JSX no longer needs import React from \'react\' just to compile it.',
        answer: true,
        why: 'The compiler now imports the jsx function from react/jsx-runtime automatically, so the import is only needed if you use React APIs directly.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In JSX, the HTML attribute for is written ____ because for is a reserved word in JavaScript.',
        answer: 'htmlFor',
        accept: ['htmlfor'],
        why: 'JSX attributes map to DOM property names. The property for a label’s target is htmlFor.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these in the order they happen for a JSX tag in a typical React project.',
        items: [
          'You write <h1>Hi</h1> in a .tsx file',
          'The build tool compiles it to a jsx() call',
          'The call returns a plain element object',
          'React reads the element to update the page',
        ],
        why: 'JSX is compiled ahead of time to function calls. At run time those calls produce elements, which React then reads.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A list renders {users.map(u => <li>{u.name}</li>)} and the console warns about keys. Which fix is best when each user has a unique id?',
        options: [
          '<li key={u.id}>{u.name}</li>',
          '<li key="user">{u.name}</li>',
          '<li id={u.id}>{u.name}</li>',
          '<ul key={users.length}>…</ul>',
        ],
        answer: 0,
        why: 'The key must be unique among siblings and stable for the same item. A constant string collides, and id is not a key.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-3': {
    summary: 'The virtual DOM is React’s lightweight tree of elements; React compares old and new trees and updates only what changed in the real DOM.',
    lesson: {
      minutes: 8,
      objectives: [
        'Describe the render, diff and commit steps React performs when state changes',
        'Predict which real DOM nodes are touched when a component re-renders with new state',
        'Explain why re-rendering a component is not the same as updating the DOM',
        'Evaluate the claim that the virtual DOM makes React faster than hand-written DOM code',
      ],
      simple:
        'When your data changes, React builds a fresh lightweight copy of what the page should look like and compares it with the previous copy. Only the differences are applied to the real page. This means you write simple “draw everything” code, and React does the careful, minimal editing.',
      blocks: [
        {
          type: 'text',
          title: 'Why a second tree?',
          body:
            'The DOM, the browser’s live tree of page elements, is not slow by itself. What costs time is what happens after you change it: the browser may need to recalculate layout (where everything goes) and repaint pixels. Doing this many times for tiny changes wastes effort. React’s answer is to work in two steps. First it builds a cheap, in-memory description of the UI, a tree of plain JavaScript objects called the virtual DOM. Then it works out the smallest set of real DOM changes and applies them together. The virtual DOM is a design pattern, not a separate browser feature.',
        },
        {
          type: 'analogy',
          body:
            'An architect redrawing a house plan. When you want a new window, you do not demolish the house and rebuild it. You mark the new plan, compare it with the old one, and hand the builder a short list: “add a window on the north wall.” The plan is the virtual DOM; the house is the real DOM; the builder is React.',
        },
        {
          type: 'text',
          title: 'Render, diff, commit',
          body:
            'Every update goes through the same pipeline. In the render phase, React calls your component functions and collects the elements they return, building the new virtual tree. In the diff step, React compares the new tree with the previous one to find differences (the next topic covers the algorithm). In the commit phase, React applies the minimal set of changes to the real DOM and then runs effects such as useEffect. Rendering in React therefore means *calling your component*, not drawing on the screen. A component can render many times without the DOM changing at all.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `function Profile({ name, online }: { name: string; online: boolean }) {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>{online ? 'Online' : 'Offline'}</p>
    </div>
  );
}

// Render 1: <Profile name="Asha" online={false} />
// div.card > [ h2 "Asha", p "Offline" ]
//
// Render 2: <Profile name="Asha" online={true} />
// div.card > [ h2 "Asha", p "Online" ]
// Diff: only the text inside <p> changed.`,
          caption:
            'The two comments show the virtual trees for two renders. React sees that the div, h2 and p are the same types in the same places, and only the text of p differs, so it updates one text node in the real DOM.',
        },
        {
          type: 'text',
          title: 'What the diff buys you',
          body:
            'Because React edits the existing DOM nodes instead of replacing them, things the browser stores on those nodes survive: the cursor position and typed text in an input, scroll position, focus and CSS animations in progress. If you replaced the entire HTML each time, a user typing in a search box would lose focus after every keystroke. Batching also helps. If one click handler calls setState three times, React groups them into one render and one commit (React 18 does this everywhere, including timeouts and promises).',
        },
        {
          type: 'text',
          title: 'Is the virtual DOM always faster?',
          body:
            'Not necessarily. A hand-tuned script that changes one known text node will beat any framework, because React must first run your components and compare trees. The honest benefit is that React is fast *enough* for most apps while letting you write simple declarative code, and the tree description can be rendered by other renderers too: react-dom for browsers, React Native for mobile apps, and server rendering for HTML strings. Re-running a component is cheap compared with touching the DOM, but a very large component tree that re-renders on every keystroke can still feel slow, which later modules on memoisation address.',
        },
        {
          type: 'example',
          title: 'Worked example: a counter and a clock',
          body:
            'Consider <div><h1>Count: {count}</h1><Clock /></div>, where Clock displays the time and updates by itself each second. Initially count is 0. The user clicks a button and setCount(1) is called. React renders: the root component runs again and returns <div><h1>Count: 1</h1><Clock /></div>. It diffs against the old tree. The div and h1 keep their types, and the h1’s text changed from “Count: 0” to “Count: 1”. Commit step: React updates that one text node. The Clock’s DOM nodes are not replaced. Note that by default React still *re-renders* Clock (calls the function again) because its parent rendered, but its output is the same, so the DOM does not change. That distinction, a component rendering versus the DOM updating, is the key to reading performance advice later.',
        },
        {
          type: 'compare',
          title: 'Rendering versus committing',
          columns: ['Render phase', 'Commit phase'],
          rows: [
            ['What happens', 'Your component functions run and return elements', 'React applies the changes to the real DOM'],
            ['Touches the DOM?', 'No, only builds the virtual tree', 'Yes, with the minimal set of edits'],
            ['Must be pure?', 'Yes, same input gives same output', 'Not applicable: effects run here'],
            ['Can run more than once', 'Yes, e.g. Strict Mode in development', 'Once per update'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Virtual DOM', def: 'A lightweight tree of React elements that describes the UI and is compared between renders.' },
            { term: 'Render phase', def: 'The step where React calls components to produce the new element tree.' },
            { term: 'Diffing', def: 'Comparing the previous and next element trees to find what changed.' },
            { term: 'Commit phase', def: 'The step where React applies the minimal changes to the real DOM and runs effects.' },
            { term: 'Batching', def: 'Grouping several state updates into one re-render.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Never edit React-managed DOM directly with document.querySelector(...).textContent = ... inside a component. On the next render React will overwrite your change or become confused about what is on the page.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body:
            'In development, React’s Strict Mode deliberately calls component functions twice to expose impure code. This is one reason why render must have no side effects.',
        },
        {
          type: 'summary',
          points: [
            'The virtual DOM is a tree of cheap element objects; the real DOM is changed only in the commit phase.',
            'React renders, diffs the new tree against the old, and applies only the minimal real DOM edits.',
            'A component re-rendering does not mean the DOM changed; unchanged output leaves the DOM alone.',
            'Reusing DOM nodes preserves input focus, typed text and scroll position.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A Profile component re-renders because a parent’s state changed, but it returns exactly the same elements as before. What does React do to the real DOM for Profile?',
        options: [
          'Replaces all of Profile’s DOM nodes with fresh ones because the component function ran again',
          'Leaves Profile’s DOM nodes unchanged because the diff finds no differences',
          'Reloads the page to guarantee consistency',
          'Removes and re-adds only the text nodes',
        ],
        answer: 1,
        why: 'Rendering only builds the virtual tree. If the diff shows nothing changed, the commit phase makes no DOM edits for that part of the tree.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A user is typing in an input. On each keystroke a parent updates a counter state. Why does the input usually keep focus and its text?',
        options: [
          'React stores keystrokes in a database and replays them',
          'React blocks the parent from rendering while typing',
          'The browser automatically restores focus after every reload',
          'React reuses the same input DOM node instead of replacing it',
        ],
        answer: 3,
        why: 'The diff sees an input of the same type in the same position, so the existing DOM node is kept. Browser-held state such as focus and the cursor stays with it.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Old tree: <ul><li>A</li><li>B</li></ul>. New tree: <ul><li>A</li><li>C</li></ul>. Which real DOM change does React need?',
        options: [
          'Create a brand new ul element and two new li nodes, then swap them in',
          'Change only the text of the second li from B to C',
          'Remove the first li and add a new one',
          'Replace the ul with a div',
        ],
        answer: 1,
        why: 'The types and positions match, and only the text of the second li differs, so a single text update is enough.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these happen during the commit phase?',
        options: [
          'React applies changes to the real DOM',
          'Your component function is called to return JSX',
          'useEffect callbacks run after the DOM is updated',
          'The new virtual tree is compared with the old one',
        ],
        answers: [0, 2],
        why: 'The commit phase writes to the DOM and then runs effects. Calling components and building the tree are render-phase work, and diffing happens before committing.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In React, a component function being called again means that the real DOM nodes it produced have necessarily been replaced.',
        answer: false,
        why: 'Calling the function only produces a new virtual tree. The real DOM is touched only for the differences found by the diff, and often not at all.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'After a state change, React first runs the components to build a new tree, then compares it with the old one, and finally ____ the differences to the real DOM.',
        answer: 'commits',
        accept: ['commit', 'applies', 'apply'],
        why: 'The final step is the commit phase, which applies the minimal changes to the real DOM.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A teammate says: “The virtual DOM makes React always faster than writing document.getElementById(...).textContent = ... by hand.” What is the best response?',
        options: [
          'Correct, because the browser can skip layout work whenever virtual nodes are used',
          'Correct, because React avoids running any JavaScript of yours while it updates',
          'Not always: targeted hand-written updates can be faster, but React keeps code simple and is fast enough',
          'Incorrect, because React always rewrites the entire DOM again on every single update',
        ],
        answer: 2,
        why: 'React still has to run components and diff trees, which is extra work. Its value is declarative code with good-enough performance, not a guaranteed speed advantage.',
        difficulty: 3,
      },
      {
        type: 'order',
        q: 'Put the steps of a React update, triggered by setCount(count + 1), in order.',
        items: [
          'The setter schedules a re-render',
          'The component functions run and return a new element tree',
          'React diffs the new tree against the old tree',
          'The real DOM is updated with the minimal changes',
          'Effects run after the commit',
        ],
        why: 'State change triggers a render, then the diff finds differences, then the commit writes to the DOM and runs effects.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A page shows 1,000 rows. When a single row’s status changes from “Pending” to “Done”, what does React’s diff aim to produce for the real DOM?',
        options: [
          'Rebuilding all 1,000 rows to be safe',
          'Replacing the table element with a new one containing all 1,000 rows',
          'A single small edit to the text in that one row',
          'Reloading the data from the server',
        ],
        answer: 2,
        why: 'Same element types in the same positions mean only the changed text needs updating, so the commit is tiny even though the tree is large.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A click handler runs: setA(1); setB(2); setC(3); in React 18. How many renders does React normally perform for this one event?',
        options: ['Three, one for each of the three setter calls', 'Zero until the next click', 'One, because updates are batched', 'Six, because Strict Mode doubles each of the three updates'],
        answer: 2,
        why: 'React batches state updates inside the same event and renders once with all new values, which avoids wasted work.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which statement best describes a “React element” such as <h1>Hi</h1>?',
        options: [
          'A reference to a node already attached to the document, updated in place by React',
          'A plain object describing what should appear, with a type and props',
          'A compiled HTML string that is injected into the page',
          'A class instance with its own lifecycle methods',
        ],
        answer: 1,
        why: 'Elements are cheap plain objects. They describe the UI, and React turns them into DOM nodes only when needed.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A developer adds document.getElementById(\'title\').style.color = \'red\' inside a component body. After the next state update the colour disappears. What is the most likely reason?',
        options: [
          'React re-applied the style from its own description, ignoring the manual DOM edit',
          'Browsers automatically forget inline styles that scripts set, after about one second',
          'The virtual DOM keeps a cached copy of the old style and blocks every later change',
          'The getElementById call crashed React',
        ],
        answer: 0,
        why: 'React owns that DOM node and writes what its element description says. Manual edits behind its back are unreliable. Put the colour in the JSX instead.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which of these can the same virtual-tree idea be used for, with a different renderer, according to how React is built?',
        options: [
          'Only HTML in desktop browsers, because the idea depends on the DOM',
          'Only server-side string output, since renderers cannot target screens',
          'Only Android widgets, since React Native replaced the browser renderer',
          'Browser DOM, native mobile views and server HTML output',
        ],
        answer: 3,
        why: 'The tree of elements is renderer-independent. react-dom, React Native and react-dom/server each turn it into a different output.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'In development, a component logs “render” twice per update. What is the most likely explanation?',
        options: [
          'The component is broken and renders in an infinite loop that React eventually stops',
          'The DOM was committed twice',
          'Strict Mode intentionally calls render twice to expose side effects',
          'The browser fired the click event twice',
        ],
        answer: 2,
        why: 'Strict Mode double-invokes render in development to help you notice impure code. It does not happen in production builds.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are advantages of describing the UI as a virtual tree and diffing it?',
        options: [
          'You can write the UI declaratively for each state',
          'Existing DOM nodes are reused, keeping focus and typed text',
          'Updates are guaranteed to be faster than any manual DOM code',
          'The same description can target browsers or mobile with different renderers',
        ],
        answers: [0, 1, 3],
        why: 'Declarative code, DOM reuse and renderer independence are real benefits. A guaranteed speed win is not, since hand-tuned code can beat React.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'A parent component with a counter state re-renders and its child <Footer /> has no props. Which statements are true by default?',
        options: [
          'Footer’s function is called again',
          'Footer’s DOM nodes are rebuilt from scratch',
          'The DOM is changed only if Footer’s output differs',
          'The counter state is copied into Footer',
        ],
        answers: [0, 2],
        why: 'Children re-render by default when the parent does, but identical output means no DOM edits. Later topics show how to skip even the re-render.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'During the render phase, React may call a component more than once for the same update, which is why render code should have no side effects.',
        answer: true,
        why: 'Strict Mode and concurrent rendering can call or restart render, so anything that changes the outside world must live in effects or handlers.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In React’s pipeline, the step where the real DOM is updated and effects are run is called the ____ phase.',
        answer: 'commit',
        accept: ['Commit'],
        why: 'The render phase builds the new tree and the commit phase applies it. Effects run after the commit.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each React term to its meaning.',
        pairs: [
          ['Render phase', 'Calls components to build the new element tree'],
          ['Diffing', 'Finds differences between old and new trees'],
          ['Commit phase', 'Applies minimal edits to the real DOM'],
          ['Batching', 'Merges several state updates into one render'],
        ],
        why: 'These four ideas describe the whole update cycle: render, compare, apply, and group updates to avoid extra work.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A list has 5,000 items and a text box above it; typing re-renders the whole component on each keystroke, and the page feels slow. Which diagnosis fits what you know about the virtual DOM?',
        options: [
          'The virtual DOM cannot handle long lists, so every item is fully rebuilt',
          'The browser cannot reuse the input nodes that React already created before',
          'React has to rebuild the whole real DOM from scratch on each keystroke',
          'Re-running 5,000 child components on each keystroke is costly even if the DOM edits are few',
        ],
        answer: 3,
        why: 'The diff keeps DOM edits small, but calling thousands of component functions each render still takes time. Memoisation or splitting state can reduce it.',
        difficulty: 3,
      },
    ],
  },
  'react-gen-4': {
    summary: 'Reconciliation is React’s fast comparison of old and new trees, using element type and key to decide what to keep, update or rebuild.',
    lesson: {
      minutes: 9,
      objectives: [
        'Apply the two reconciliation rules (element type and key) to predict whether state is kept or reset',
        'Explain why index keys cause bugs when a list is reordered or has items inserted',
        'Fix a component that remounts on every render because it is defined inside another component',
        'Use a changing key deliberately to reset a component’s state',
      ],
      simple:
        'After every update React must decide which parts of the old screen can be reused. It follows two simple rules: if an element’s type changes, throw that part away and rebuild it; if it stays the same, keep it and update it. For lists, the key tells React which item is which.',
      blocks: [
        {
          type: 'text',
          title: 'The comparison problem',
          body:
            'Reconciliation is the process React uses to compare the previous element tree with the next one and work out the changes. A perfect tree comparison is expensive: the best general algorithms take O(n³) steps, which means a tree of 1,000 elements would need about a billion comparisons. That is too slow for a UI. React instead uses two assumptions, called heuristics, that make the comparison linear, O(n), meaning the work grows in proportion to the number of elements. The assumptions work for real interfaces, and they explain many surprising behaviours such as lost input text and remounting components.',
        },
        {
          type: 'analogy',
          body:
            'A teacher taking attendance after a seating change. She does not recompute who everyone is. She looks at each seat: same student, same seat, nothing to do. For lists, she uses name tags (keys) rather than seat numbers, so a student who moves from row 1 to row 3 is still recognised as the same person.',
        },
        {
          type: 'text',
          title: 'Rule 1: different type, different tree',
          body:
            'React compares elements at the same position. If the type differs, for example a div becomes a span, or <Counter /> becomes <Timer />, React assumes the whole subtree is different. It *unmounts* the old one, destroying its DOM nodes and discarding all state of every component inside, and *mounts* a fresh one. If the type is the same, React keeps the existing instance and only updates changed props or attributes, then repeats the process for the children. This is why a counter inside a div loses its count if you change that div into a section, even though nothing else changed.',
        },
        {
          type: 'text',
          title: 'Rule 2: keys identify list items',
          body:
            'When a parent renders a list of children, matching by position is risky. Suppose a new item is added at the top. Compared by position, every item looks changed. The key prop solves this: React matches children that have the same key, even if they moved. A good key is unique among its siblings and stays the same for the same item across renders, such as a database id. Do not use Math.random(), which changes every render and makes React rebuild every item. Using the array index is only safe for static lists that are never reordered, filtered or inserted into, because the index then identifies a position and not the item, so state such as typed text stays with the position and ends up on the wrong row.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `function Page({ user }: { user: User }) {
  // key resets the form when the user changes
  return <ProfileForm key={user.id} user={user} />;
}

function Parent() {
  // Bug: Child is a new function on every render,
  // so React sees a new type and remounts it each time
  function Child() {
    const [text, setText] = useState('');
    return <input value={text} onChange={(e) => setText(e.target.value)} />;
  }
  return <Child />;
}`,
          caption:
            'In Page, changing user.id changes the key, so React discards the old ProfileForm and mounts a fresh one with empty state: a deliberate reset. In Parent, Child is redefined on every render, so its type is never equal to the previous one. The input is rebuilt on each keystroke and loses focus. Define components at the top level of the file instead.',
        },
        {
          type: 'example',
          title: 'Worked example: index keys versus id keys',
          body:
            'A to-do list shows [Milk, Eggs] and each row has an uncontrolled input where the user may type a note. The user types “2 packets” in the Milk row. Now a new task, Bread, is added at the top: [Bread, Milk, Eggs]. With key={index}, the keys are 0, 1, 2. React matches key 0 (formerly Milk) with Bread, so it updates the text “Milk” to “Bread”, but the DOM input that held “2 packets” is at key 0, so the note now sits beside Bread. With key={task.id}, Milk keeps its id, so React sees that Milk moved down one position, keeps its row, and inserts a new row for Bread. The note stays with Milk. Same data, different keys, correct versus wrong result.',
        },
        {
          type: 'steps',
          title: 'How React reconciles one node',
          steps: [
            'Compare the type of the old and new element at this position.',
            'If the types differ, unmount the old subtree and mount the new one (all state in the old subtree is lost).',
            'If the types are the same, keep the instance and update props or DOM attributes.',
            'Recurse into the children; for lists, match children by key first, then by position.',
            'Insert new keys, remove missing keys and reorder matched ones.',
          ],
        },
        {
          type: 'compare',
          title: 'Same type versus different type at the same position',
          columns: ['Same type (div to div)', 'Different type (div to section)'],
          rows: [
            ['DOM node', 'Reused and updated', 'Destroyed and recreated'],
            ['Child component state', 'Preserved', 'Lost (unmount then mount)'],
            ['Effects of children', 'Not re-run unless dependencies change', 'Cleanup runs, then effects run again'],
            ['Cost', 'Cheap attribute updates', 'Rebuild of the entire subtree'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Reconciliation', def: 'The process of comparing old and new element trees to decide the minimal DOM changes.' },
            { term: 'Heuristic', def: 'A practical assumption that makes an algorithm fast but is not always perfectly optimal.' },
            { term: 'key', def: 'A stable, unique identifier among siblings that lets React track items across renders.' },
            { term: 'Mount / unmount', def: 'Creating a component instance and its DOM, or destroying them with their state.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Do not use the array index or Math.random() as a key for lists that can change. Index keys attach state to the wrong item after inserts and reorders; random keys force every item to remount on every render.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body:
            'Need to reset a component’s state? Give it a key that changes, such as key={userId}. It is cleaner than copying props into state with an effect.',
        },
        {
          type: 'summary',
          points: [
            'React reconciles in O(n) using two heuristics: a different element type means a different subtree, and keys identify items in lists.',
            'A type change at a position unmounts the old subtree and loses its state; the same type keeps state and updates props.',
            'Keys must be unique among siblings and stable for each item; prefer database ids over indexes or random numbers.',
            'Never define a component inside another component, because a new function type is created on every render.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A component renders {isEditing ? <div><Counter /></div> : <section><Counter /></section>}. The user increments the counter to 5 and then toggles isEditing. What is the counter value afterwards?',
        options: ['5, because Counter is the same component', '0, because the parent type changed from div to section', '6, because React runs the increment again when the section remounts', 'It depends on the browser'],
        answer: 1,
        why: 'The parent element type changed at the same position, so React unmounts the whole subtree, destroying Counter’s state, and mounts a new one.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Rows [A, B, C] use key={index} and each row has an input holding typed text. The first row is deleted. Which problem can the user see?',
        options: [
          'Row B’s text appears on the row for A because keys 0 and 1 are reused',
          'Nothing changes because index keys are always safe when rows are only ever removed',
          'React throws an exception for a missing key',
          'All rows are rebuilt and become empty',
        ],
        answer: 0,
        why: 'With index keys the DOM row at key 0 stays and receives the next item’s data, so typed text stays with the position rather than moving with the item.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which key is best for rows loaded from a database table where each row has id, name and createdAt?',
        options: [
          'key={Math.random()}',
          'key={row.name}, even though two rows can share a name',
          'key={row.id}',
          'key={rowIndex}, because it is the shortest value',
        ],
        answer: 2,
        why: 'A key must be unique among siblings and stable for each item. A database id fits both rules, while names can repeat and random values change each render.',
        difficulty: 1,
      },
      {
        type: 'multi',
        q: 'Which situations make React throw away a component’s state and mount a fresh instance?',
        options: [
          'The component’s key prop changes',
          'The component’s props change to new values',
          'The element type at that position changes from <Form /> to <Wizard />',
          'The parent re-renders with the same type and key',
        ],
        answers: [0, 2],
        why: 'A changed key or element type means a different identity. Changed props or a parent re-render alone keep the same instance and its state.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Defining function Row() { … } inside another component’s body is harmless, because React recognises Row by its name.',
        answer: false,
        why: 'React compares the function object itself. A new function is created on each render, so Row looks like a different type and remounts, losing state and focus.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To tell React which list item is which across renders, each sibling should receive a stable, unique ____ prop.',
        answer: 'key',
        accept: ['Key'],
        why: 'The key prop is the item’s identity. React uses it to match, move, add and remove items rather than relying on position alone.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A tree has 1,000 elements. The best general tree-diff algorithms need roughly n³ steps. About how many steps is that, compared with React’s heuristic approach that is linear?',
        options: [
          'About 1,000 million steps versus about 1,000 steps',
          'About 1 million steps versus about 1,000 steps',
          'About 3,000 steps versus about 1,000 steps',
          'About 1,000 steps versus about 1,000 steps',
        ],
        answer: 0,
        why: '1,000³ = 1,000,000,000 (a billion) steps for the general algorithm, while a linear pass needs about 1,000. That gap is why React uses heuristics.',
        difficulty: 3,
      },
      {
        type: 'code',
        q: 'A ProfileForm should reset all of its internal state whenever userId changes. Write the JSX that renders <ProfileForm userId={userId} /> so that React remounts it when userId changes.',
        language: 'tsx',
        starter: 'function Page({ userId }: { userId: number }) {\n  return <ProfileForm userId={userId} />;\n}',
        solution: 'function Page({ userId }: { userId: number }) {\n  return <ProfileForm key={userId} userId={userId} />;\n}',
        checks: [
          { label: 'Renders ProfileForm', pattern: String.raw`<ProfileForm\b` },
          { label: 'Passes key from userId', pattern: String.raw`key\s*=\s*\{\s*userId\s*\}` },
        ],
        why: 'A changed key tells React the element is a different instance, so it unmounts the old one and mounts a new one with fresh state.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'This list is rendered with {tasks.map(t => <TaskRow key={t.id} task={t} />)}. A new task with a new id is added at the start. What does React do with the existing rows?',
        options: [
          'Updates each row’s content to the item one position earlier and appends one new row at the end',
          'Rebuilds every row from scratch',
          'Keeps each existing row, matched by key, and inserts one new row at the top',
          'Ignores the new task until the next render',
        ],
        answer: 2,
        why: 'Keys let React match each existing row to its task, so only a new row is created. Position-based matching would have changed every row.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A developer writes {items.map(i => <Item key={Math.random()} item={i} />)}. What is the effect?',
        options: [
          'Faster renders, since random keys avoid collisions and let React skip work',
          'Every Item remounts on every render, losing state and focus',
          'React skips rendering the list altogether',
          'Nothing; random keys are as good as ids',
        ],
        answer: 1,
        why: 'A key that changes each render tells React every item is brand new, so it destroys and recreates all the DOM nodes and state.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Old: <div><h1>Hi</h1></div>. New: <div><h1 className="big">Hi</h1></div>. What does reconciliation do?',
        options: [
          'Unmounts the div and rebuilds the whole tree because an attribute changed',
          'Replaces the h1 with a new h1 element',
          'Keeps both elements and updates only the class attribute of the h1',
          'Throws away the text node but keeps the h1',
        ],
        answer: 2,
        why: 'Types and positions match, so the existing DOM nodes are kept and only the changed attribute is updated.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A search box inside a component loses focus after every keystroke. The input is rendered by a component Field that is declared inside the page component. Which fix is correct?',
        options: [
          'Add autoFocus to the input so it regains focus after each keystroke',
          'Wrap the page in a Fragment',
          'Move the Field declaration outside the page component',
          'Give the input a random key',
        ],
        answer: 2,
        why: 'Field is a new function on each render, so React remounts it. Declaring it at module level gives it a stable type that React can reuse.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A tab panel shows <Chat user={user} /> and you want the draft message to be cleared whenever the selected user changes, without writing an effect. What is the simplest approach?',
        options: [
          'Render <Chat key={user.id} user={user} />',
          'Call setDraft(\'\') inside the render function body',
          'Store the draft in a global variable',
          'Change the element type each render',
        ],
        answer: 0,
        why: 'Changing the key makes React treat Chat as a new instance, so its state starts fresh. Calling a setter during render is an anti-pattern.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Two sibling items in the same list both have key="a". What is the likely result?',
        options: [
          'React merges them into one item',
          'The warning is shown and React may duplicate or drop items when updating',
          'Nothing; sibling keys can repeat',
          'React renames the second key automatically and silently keeps both items stable',
        ],
        answer: 1,
        why: 'Keys must be unique among siblings. Duplicates make matching ambiguous, so updates can produce duplicated or missing rows.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are good key choices for a list that users can reorder and filter?',
        options: [
          'A database id such as order.id',
          'A UUID generated once when the item is created and stored with it',
          'The array index',
          'A new Math.random() value on each render',
        ],
        answers: [0, 1],
        why: 'Both ids and stored UUIDs stay with the item across renders. Index follows position, and random values change every render.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which two assumptions (heuristics) does React’s reconciliation algorithm make?',
        options: [
          'Elements of different types produce different trees',
          'Keys can identify which children are stable across renders',
          'Every component should be re-created on each update',
          'The real DOM should be compared directly with the new tree',
        ],
        answers: [0, 1],
        why: 'React assumes a type change means a new subtree and relies on keys to identify list children. These assumptions keep the diff linear.',
        difficulty: 1,
      },
      {
        type: 'truefalse',
        q: 'When a component receives a new prop value but keeps the same type and key, React keeps its state and updates it in place.',
        answer: true,
        why: 'Same type and same key at the same position means the same instance. React passes the new props and keeps the existing state.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'When the type of an element at a position changes, React ____ the old subtree and mounts a new one, so its state is lost.',
        answer: 'unmounts',
        accept: ['unmount', 'destroys', 'removes', 'tears down'],
        why: 'A type change triggers unmount for the old subtree, which also runs effect cleanups, and then a mount for the new one.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'Put these in the order React handles one position during reconciliation.',
        items: [
          'Compare old and new element types',
          'If types differ, unmount the old subtree',
          'If types match, update the existing instance’s props',
          'Recurse into the children',
        ],
        why: 'React first checks the type, then either rebuilds or updates, and finally repeats for children, which keeps the pass linear.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A cart shows [Pen, Ink] with key={index}, and each row has a checkbox. Ink is checked. The list becomes [Ink] after Pen is removed. Which row is checked in the new list?',
        options: [
          'Ink is unchecked because it moved to key 0, whose checkbox state was Pen’s',
          'Ink is checked because index keys follow the item',
          'No row is checked because React clears every checkbox whenever the list shrinks',
          'Both rows are checked',
        ],
        answer: 0,
        why: 'Before removal Pen was at key 0 (unchecked) and Ink at key 1 (checked). After removal key 1 disappears and key 0 keeps Pen’s checkbox state, now showing Ink.',
        difficulty: 3,
      },
    ],
  },
  'react-gen-5': {
    summary: 'Fiber is React’s reconciliation engine: it splits rendering into small units of work that can be paused, prioritised and resumed.',
    lesson: {
      minutes: 9,
      objectives: [
        'Explain why the older recursive reconciler could freeze the interface and how Fiber avoids this',
        'Describe a fiber as a unit of work and name the current and work-in-progress trees',
        'Distinguish the interruptible render phase from the synchronous commit phase',
        'Use startTransition or useDeferredValue to keep an input responsive while heavy work is deferred',
      ],
      simple:
        'Fiber is the engine inside React that does the rendering work in small pieces. Because the work is split up, React can pause to handle something urgent, like a keystroke, and come back to finish a heavy update later. This keeps the page feeling smooth.',
      blocks: [
        {
          type: 'text',
          title: 'The problem Fiber solved',
          body:
            'Before React 16, reconciliation was recursive: React walked the whole component tree in one go, using the JavaScript call stack. JavaScript in a browser runs on a single main thread, which also handles clicks, typing and painting at about 60 frames per second, meaning roughly 16 milliseconds per frame. If a render took 200 ms, the browser could not respond to the user during that time, so typing felt laggy and animations froze. React 16 (2017) replaced the engine with Fiber, a complete rewrite that lets rendering be split into small chunks. Fiber is the foundation that React 18 builds on for concurrent features.',
        },
        {
          type: 'analogy',
          body:
            'Reading a long book in a library while people keep asking you questions. The old way: you refuse to look up until you finish the whole book. Fiber: you place a bookmark after every page. When someone asks something urgent, you answer at once, then return to the bookmark and continue. The bookmark is the saved position in the tree.',
        },
        {
          type: 'text',
          title: 'What a fiber is',
          body:
            'A *fiber* is a plain JavaScript object that React creates for each component instance or DOM element in the tree. It stores the element’s type and key, its current props and state, and links to other fibers: child (first child), sibling (next element at the same level) and return (the parent). These links make the tree a linked structure that React can walk with a simple loop instead of recursion, so it can stop after any fiber and later resume from exactly where it left off. A fiber is also a *unit of work*: React processes one fiber, then asks whether it should pause.',
        },
        {
          type: 'text',
          title: 'Two trees: current and work-in-progress',
          body:
            'React keeps two fiber trees, like a stage and a rehearsal room. The *current* tree is what is on screen now. When an update starts, React builds a *work-in-progress* tree beside it, reusing fibers where it can, and calls your components to fill it in. Because it works off-screen, nothing the user sees is half-finished. When the render completes, React swaps the pointer so the work-in-progress tree becomes the current one. That swap happens in the commit phase. If a higher-priority update arrives mid-way, React can throw away the unfinished work-in-progress tree and start again. This is why render functions must be pure and may be called more than once.',
        },
        {
          type: 'text',
          title: 'Interruptible render, synchronous commit',
          body:
            'The two phases behave differently. The render phase (calling components and diffing) can be interrupted, paused or restarted in concurrent rendering. The commit phase (writing to the DOM, running layout effects) is always synchronous and cannot be stopped, because a half-updated DOM would be visible. React also gives updates priorities: typing and clicks are urgent, while a search-results list or a data-loading screen can wait. React 18 turns these abilities on when you create the root with createRoot, and gives you tools to mark work as non-urgent: startTransition and useDeferredValue.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `import { useState, useTransition } from 'react';

function Search({ products }: { products: string[] }) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(products);
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);                       // urgent: keep typing smooth
    startTransition(() => {
      setShown(products.filter((p) => p.includes(q))); // can wait
    });
  }

  return (
    <>
      <input value={query} onChange={onChange} />
      {isPending && <p>Updating…</p>}
      <List items={shown} />
    </>
  );
}`,
          caption:
            'setQuery is an urgent update, so the input shows each character immediately. Updates inside startTransition are marked non-urgent: React can interrupt the heavy list render when the next keystroke arrives. useTransition also returns isPending, true while the deferred work is still running.',
        },
        {
          type: 'example',
          title: 'Worked example: typing into a heavy search',
          body:
            'A page filters 20,000 products and re-rendering the list takes about 120 ms. Without transitions, each keystroke waits for the full render, so the user types “phone” and sees letters appear in laggy bursts of 120 ms. Now they type “p”, then “h” 50 ms later. With the transition code above: “p” updates the input at once and starts a low-priority render of the list. After 50 ms “h” arrives, an urgent update. React pauses the unfinished list render, discards that work-in-progress tree because it is out of date, shows “ph” in the input immediately, and begins a new list render for “ph”. The user never feels lag, and the list only finishes rendering when typing pauses. The interface stays responsive even though the total CPU work is not smaller.',
        },
        {
          type: 'compare',
          title: 'Before and after Fiber',
          columns: ['Stack reconciler (before React 16)', 'Fiber (React 16 onward)'],
          rows: [
            ['Traversal', 'Recursive call stack, runs to the end', 'Loop over linked fibers, can stop after any one'],
            ['Interruptible?', 'No, the main thread is blocked', 'Yes, in the render phase (concurrent rendering)'],
            ['Priorities', 'All updates treated alike', 'Urgent updates can jump ahead of non-urgent ones'],
            ['Enables', 'Basic updates', 'Suspense, transitions, useDeferredValue, streaming server rendering'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Fiber', def: 'A JavaScript object representing one unit of work and one node in React’s internal tree.' },
            { term: 'Work-in-progress tree', def: 'The off-screen tree React builds for an update before swapping it in as current.' },
            { term: 'Concurrent rendering', def: 'React’s ability to pause, resume or abandon render work to keep the UI responsive.' },
            { term: 'Transition', def: 'An update marked non-urgent with startTransition so urgent updates can interrupt it.' },
            { term: 'Time slicing', def: 'Splitting render work into short slices and yielding to the browser between them.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Transitions do not make slow code fast. They only let urgent updates go first. Wrapping the controlled input’s own setState in startTransition makes typing lag, because the input value itself must stay urgent.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body:
            'You never call Fiber directly. It is internal to React, and the same engine powers react-dom for browsers and React Native for phones.',
        },
        {
          type: 'summary',
          points: [
            'Fiber replaced the recursive stack reconciler in React 16 so rendering can be split into small units of work.',
            'Each fiber is an object linked to its child, sibling and parent; React builds a work-in-progress tree beside the current one and swaps them at commit.',
            'The render phase may pause, restart or be discarded; the commit phase is synchronous.',
            'Use startTransition or useDeferredValue to mark expensive updates as non-urgent so typing and clicks stay smooth.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A page re-render takes about 150 ms in the old stack reconciler and the user types during that time. What do they notice?',
        options: [
          'Keystrokes are queued or delayed until the render finishes',
          'The keystrokes are ignored completely and never shown',
          'The browser spawns a second thread to handle typing',
          'Nothing, because rendering always runs in a worker',
        ],
        answer: 0,
        why: 'Rendering ran on the main thread and could not be interrupted, so the browser could not process input until it finished. Fiber was designed to remove this problem.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'During a transition render, the user types another character. What may React do with the unfinished work-in-progress tree?',
        options: [
          'Commit it immediately, even though it is unfinished, so the screen never falls behind',
          'Discard it and start over with the newer, urgent update first',
          'Write half of it to the DOM now and then write the other half later',
          'Save it as the current tree straight away without checking it first',
        ],
        answer: 1,
        why: 'The work-in-progress tree is off-screen, so it can be thrown away safely. The urgent update is handled first and the transition restarts with fresh values.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'In this code, which state update is treated as non-urgent?\nsetText(v);\nstartTransition(() => { setResults(search(v)); });',
        options: ['setText(v)', 'Both setText and setResults', 'Neither one', 'setResults(search(v))'],
        answer: 3,
        why: 'Only the update inside startTransition is marked as a transition. setText runs as a normal urgent update so the input stays responsive.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which properties describe a fiber in React’s internals?',
        options: [
          'It is a plain JavaScript object for a unit of work',
          'It links to its child, sibling and return (parent) fibers',
          'It is a real DOM node created by the browser',
          'It records the element’s type, key and props',
        ],
        answers: [0, 1, 3],
        why: 'A fiber is an ordinary object holding type, key, props, state and links to neighbours. It is not a DOM node, though it points to one for host elements.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In React 18, the commit phase, where DOM changes are written, can be paused halfway through to handle a click.',
        answer: false,
        why: 'The commit phase is synchronous so the user never sees a half-updated DOM. Only the render phase is interruptible in concurrent rendering.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'React keeps the tree shown on screen, called the ____ tree, and builds a separate work-in-progress tree for the next update.',
        answer: 'current',
        accept: ['Current'],
        why: 'The current tree represents what is on screen. When the work-in-progress tree is ready, it is swapped in and becomes the new current tree.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A developer wraps the setter of a controlled input in a transition: startTransition(() => setQuery(e.target.value)). The input now feels laggy. Why?',
        options: [
          'Transitions always double the number of renders',
          'Controlled input values must remain urgent so typing appears immediately',
          'startTransition works only inside useEffect',
          'The browser blocks transitions on text inputs, so the value would never update',
        ],
        answer: 1,
        why: 'A transition may be delayed or interrupted, so the input would show old text. Keep the input’s own state urgent and defer only the expensive derived update.',
        difficulty: 3,
      },
      {
        type: 'order',
        q: 'Put these steps in order for a concurrent update in React 18.',
        items: [
          'A state update is scheduled with a priority',
          'React builds the work-in-progress tree in small units of work',
          'Render finishes without being superseded',
          'React commits the changes to the DOM synchronously',
          'The work-in-progress tree becomes the current tree',
        ],
        why: 'React schedules, renders in interruptible slices, then commits all changes at once and swaps the trees.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A table of 10,000 rows filters as the user types. The input lags. Which change best keeps typing smooth?',
        options: [
          'Move the filtering step into the commit phase so it runs later',
          'Disable the input box until the whole filter has finished running',
          'Replace the table element with a Fragment so there is less to draw',
          'Update the input value urgently and the filtered list inside startTransition',
        ],
        answer: 3,
        why: 'Splitting urgent (the input text) from non-urgent (the list) updates lets React interrupt the heavy render when new keystrokes arrive.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const deferredQuery = useDeferredValue(query); <Results q={deferredQuery} /> What does this give you?',
        options: [
          'Results receives a lagging copy of query that updates at lower priority',
          'Results never updates when query changes',
          'query is fetched from the server before rendering, then cached for each later render',
          'Results always renders twice per keystroke',
        ],
        answer: 0,
        why: 'useDeferredValue returns an older value during urgent updates and catches up in a background render, so typing stays responsive.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Where do you opt in to React 18’s concurrent features?',
        options: [
          'By importing React from a separate concurrent package of its own, published as react-concurrent',
          'By adding a use concurrent directive at the top of every single file in the project, like use client',
          'By creating the root with createRoot (from react-dom/client) instead of ReactDOM.render',
          'By setting a concurrent flag inside the package.json file',
        ],
        answer: 2,
        why: 'React 18’s createRoot API enables concurrent rendering. The legacy ReactDOM.render keeps the old synchronous behaviour.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Why must component functions be pure given that Fiber may restart the render phase?',
        options: [
          'The browser forbids components from calling other functions during render',
          'Because Fiber compiles components into fibers once and then never runs them again, so the first result is reused',
          'A render can be called multiple times or discarded, so side effects would repeat or leak',
          'Because impure functions are slower to parse',
        ],
        answer: 2,
        why: 'Since unfinished render work can be thrown away and redone, side effects during render could run several times or for a render that never commits.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Roughly how long is a frame budget at 60 frames per second?',
        options: ['About 1 ms', 'About 16 ms', 'About 160 ms', 'About 1,000 ms'],
        answer: 1,
        why: '1000 ms ÷ 60 ≈ 16.7 ms. Long tasks on the main thread beyond this budget cause dropped frames, which Fiber’s time slicing avoids.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'isPending from useTransition is true. What does it tell you?',
        options: [
          'A transition update has been scheduled and has not committed yet',
          'The component has crashed and an error boundary is waiting to restart it',
          'The network request failed',
          'The commit phase is running',
        ],
        answer: 0,
        why: 'isPending is true while the transition render is outstanding, so you can show a spinner or dim the old results.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these does Fiber make possible?',
        options: [
          'Pausing and resuming render work',
          'Giving urgent updates priority over non-urgent ones',
          'Skipping the commit phase for faster updates',
          'Building a work-in-progress tree off-screen',
        ],
        answers: [0, 1, 3],
        why: 'Fiber’s linked structure lets React stop and restart render work, prioritise it and build the next tree away from the screen. The commit still happens.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which updates are good candidates to wrap in startTransition?',
        options: [
          'Switching a big tab whose content takes time to render',
          'Updating the text of a controlled input as the user types',
          'Applying a filter to a long list based on typed text',
          'Toggling a menu that must open on click',
        ],
        answers: [0, 2],
        why: 'Expensive content that can wait is a good transition. The input text and an instant menu toggle must respond immediately, so they remain urgent.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Time slicing means React gives each render a fixed deadline and aborts the app if it takes longer.',
        answer: false,
        why: 'Time slicing means rendering is split into short slices with pauses in between so the browser can handle input. React yields and resumes, rather than aborting the app.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'A fiber has a pointer to its parent called return, a pointer to its first child called child, and a pointer to its next neighbour called ____.',
        answer: 'sibling',
        accept: ['Sibling', 'the sibling'],
        why: 'Child, sibling and return links turn the tree into a structure React can traverse with a loop and pause at any node.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each term with what it does.',
        pairs: [
          ['useTransition', 'Marks updates as non-urgent and reports isPending'],
          ['useDeferredValue', 'Provides a value that lags behind during urgent updates'],
          ['Work-in-progress tree', 'Off-screen tree built during an update'],
          ['Commit phase', 'Synchronous step that writes the changes to the DOM'],
        ],
        why: 'Transitions and deferred values express priority to React; the two trees and the commit phase explain how it applies the result.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Complete the handler so that setQuery runs urgently and the expensive setResults call is wrapped in startTransition. Assume q is the new text and filter(q) returns the results.',
        language: 'tsx',
        starter: 'function onChange(q: string) {\n  setQuery(q);\n  setResults(filter(q));\n}',
        solution: 'function onChange(q: string) {\n  setQuery(q);\n  startTransition(() => {\n    setResults(filter(q));\n  });\n}',
        checks: [
          { label: 'Calls startTransition with a function', pattern: String.raw`startTransition\s*\(\s*\(\s*\)\s*=>` },
          { label: 'setResults is inside the transition', pattern: String.raw`startTransition\s*\([^)]*\)\s*=>\s*\{?\s*setResults\s*\(` },
          { label: 'setQuery stays outside', pattern: String.raw`setQuery\s*\(\s*q\s*\)\s*;` },
        ],
        why: 'The urgent input update stays outside so typing is immediate, while the heavy list update inside startTransition can be interrupted.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-6': {
    summary: 'A component mounts when React first renders it and inserts it into the DOM; hooks replace the old class lifecycle methods.',
    lesson: {
      minutes: 9,
      objectives: [
        'Describe the three lifecycle stages (mount, update, unmount) and what happens in each for a function component',
        'Predict the order of render and effect logs for a parent and child on mount',
        'Map class lifecycle methods to their hook equivalents',
        'Explain why Strict Mode runs an effect, its cleanup and the effect again in development',
      ],
      simple:
        'Every component is born (mounted), changes over time (updates) and is removed (unmounted). In function components you do not write separate methods for each stage. Instead the function body describes what to show, and useEffect says what to do after mounting, after updates and when leaving.',
      blocks: [
        {
          type: 'text',
          title: 'The life of a component',
          body:
            'A component instance goes through three stages. It *mounts* when React first creates it and puts its DOM nodes on the page. It *updates* each time its props, state or context change and React renders it again. It *unmounts* when it is removed from the tree, for example when a condition turns false or its key changes. Mounting is not just “the function was called”. Calling the function is only the render step. The component counts as mounted after React has committed its output to the DOM. Effects, which are code you want to run after the screen is updated, run only after that commit.',
        },
        {
          type: 'analogy',
          body:
            'Hiring an employee. Mounting is the joining day: desk set up, laptop given, a welcome meeting held. Updating is the long stretch of daily work where things change. Unmounting is the exit: return the laptop and hand over files. Cleanup is that exit checklist, and each person needs the same checklist as they needed on joining.',
        },
        {
          type: 'text',
          title: 'From class methods to hooks',
          body:
            'Before React 16.8 (2019), components were classes and each stage had a method. Function components with hooks replace the methods with fewer, more flexible ideas. The constructor’s initial state becomes useState(initial). componentDidMount becomes useEffect with an empty dependency array. componentDidUpdate becomes useEffect with dependencies. componentWillUnmount becomes the function returned from an effect (the cleanup). shouldComponentUpdate is roughly React.memo. The render method is the function body itself. The mapping is a guide, not an exact match: an effect is about *synchronising with a value*, not about the moment in the lifecycle.',
        },
        {
          type: 'compare',
          title: 'Class lifecycle versus hooks',
          columns: ['Class component', 'Function component'],
          rows: [
            ['Initial state', 'constructor / this.state', 'useState(initialValue)'],
            ['Rendering', 'render()', 'The function body that returns JSX'],
            ['After first mount', 'componentDidMount', 'useEffect(() => { … }, [])'],
            ['After updates', 'componentDidUpdate(prevProps)', 'useEffect(() => { … }, [dep])'],
            ['Before removal', 'componentWillUnmount', 'Cleanup: return () => { … } inside useEffect'],
            ['Skipping renders', 'shouldComponentUpdate', 'React.memo(Component)'],
          ],
        },
        {
          type: 'code',
          language: 'tsx',
          code: `function Greeter({ name }: { name: string }) {
  console.log('render', name);          // render phase

  useEffect(() => {
    console.log('effect: mounted or name changed', name);
    return () => console.log('cleanup for', name);
  }, [name]);

  return <h1>Hello, {name}</h1>;
}

// Mount with name="Asha":
//   render Asha
//   effect: mounted or name changed Asha
// Update to name="Ravi":
//   render Ravi
//   cleanup for Asha
//   effect: mounted or name changed Ravi
// Unmount:
//   cleanup for Ravi`,
          caption:
            'The console.log in the body runs on every render. The effect runs after the DOM is committed. Before an effect re-runs, React first runs the cleanup from the previous effect with the old values, and when the component unmounts it runs the last cleanup.',
        },
        {
          type: 'text',
          title: 'Order of events on mount',
          body:
            'React renders from the top down: the parent function runs first, and as it returns children, React renders them. The result is built into the DOM bottom-up, and effects run after painting: children’s effects run before their parent’s. Refs, which point to DOM nodes, are attached during the commit, so they are available inside effects but are null during the first render. In development, Strict Mode adds one more step: after the first mount it simulates an unmount and mount again (effect, cleanup, effect) to check that your cleanup properly undoes your setup. It does not happen in production.',
        },
        {
          type: 'example',
          title: 'Worked example: parent and child logs',
          body:
            'Suppose Parent renders <Child />, and each function logs “render” plus its name, and each has useEffect(() => console.log(name + \' effect\'), []). On first mount the console shows: “Parent render”, “Child render”, then “Child effect”, then “Parent effect”. Rendering goes top-down. Effects go bottom-up, because a parent may depend on work its children have already set up. Now suppose Parent’s state changes. Both functions render again (“Parent render”, “Child render”), but no effect logs appear, because the empty dependency array means the effects run only on mount. Finally, when Parent unmounts, cleanups run, and the DOM nodes are removed. In development with Strict Mode, you would additionally see each effect run, clean up and run again on the first mount.',
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Mount', def: 'The first time a component is rendered and its output is committed to the DOM.' },
            { term: 'Update', def: 'A re-render caused by new props, state or context.' },
            { term: 'Unmount', def: 'Removal of a component from the tree, destroying its state and running effect cleanups.' },
            { term: 'Effect', def: 'Code in useEffect that runs after the commit to synchronise with something outside React.' },
            { term: 'Strict Mode', def: 'A development-only wrapper that double-invokes renders and effects to expose bugs.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Do not treat useEffect(…, []) as “componentDidMount” in your head and ignore cleanup. In Strict Mode your effect will run, clean up and run again, so code that starts something, such as a timer or subscription, must also stop it.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body:
            'Fetching data or setting up timers in the render body is a mistake. Put them in an effect or an event handler, and keep the render body free of side effects.',
        },
        {
          type: 'summary',
          points: [
            'A component mounts when its first render is committed to the DOM; the function being called is only the render step.',
            'Class methods map to hooks: useState for initial state, useEffect([]) for mount, useEffect([dep]) for updates and cleanup for unmount.',
            'Render runs top-down, effects run after the commit and child effects run before parent effects.',
            'Strict Mode in development runs effect, cleanup and effect again, so every effect needs a correct cleanup.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'Parent renders <Child />. Each logs "render X" in its body and "effect X" from useEffect(…, []). What is the order on first mount?',
        options: [
          'render Parent, render Child, effect Child, effect Parent',
          'render Parent, effect Parent, render Child, effect Child',
          'render Child, render Parent, effect Parent, effect Child',
          'effect Child, effect Parent, render Parent, render Child',
        ],
        answer: 0,
        why: 'Rendering runs top-down and effects run after the commit, children first. So the sequence is Parent render, Child render, Child effect, Parent effect.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which hook code is closest to the class method componentDidMount?',
        options: [
          'useState(() => {})',
          'useEffect(() => { … })',
          'useEffect(() => { … }, [])',
          'useMemo(() => { … }, [])',
        ],
        answer: 2,
        why: 'An effect with an empty dependency array runs after the first commit and not again, which matches componentDidMount.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A component calls fetch(\'/api/user\') directly in its function body (not in an effect or handler). What is the problem?',
        options: [
          'Fetching is not allowed in JavaScript',
          'It runs on every render and can run extra times in Strict Mode, repeating requests',
          'It only runs once on the first render, so the data goes stale and never refreshes after that',
          'It prevents the component from unmounting',
        ],
        answer: 1,
        why: 'The body runs on every render, and React may call it more than once. Side effects like network calls belong in an effect or an event handler.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'A component has useEffect(() => { start(); return () => stop(); }, []). When does stop() run?',
        options: [
          'When the component unmounts',
          'After every re-render caused by state changes',
          'Between the simulated unmount and remount in development Strict Mode',
          'Before the component’s first render',
        ],
        answers: [0, 2],
        why: 'With an empty dependency array the cleanup runs on unmount, and Strict Mode simulates an unmount and mount in development. It does not run on ordinary re-renders.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A function component is considered mounted as soon as React calls its function for the first time, even before anything is written to the DOM.',
        answer: false,
        why: 'Calling the function is only the render step. The component is mounted when its output is committed to the DOM, and effects run after that.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In a function component, the code that replaces componentWillUnmount is the ____ function returned from useEffect.',
        answer: 'cleanup',
        accept: ['Cleanup', 'clean-up', 'clean up'],
        why: 'The function returned from an effect runs before the effect re-runs and when the component unmounts, which covers the old unmount method.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each class lifecycle idea to its function-component equivalent.',
        pairs: [
          ['componentDidMount', 'useEffect with an empty dependency array'],
          ['componentDidUpdate', 'useEffect with a dependency array'],
          ['componentWillUnmount', 'The cleanup function returned by useEffect'],
          ['shouldComponentUpdate', 'React.memo around the component'],
        ],
        why: 'Hooks cover each class method with fewer, more general tools. The mapping is approximate because effects are about synchronisation.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write a Timer component that starts setInterval(tick, 1000) inside useEffect on mount and clears it with clearInterval when the component unmounts. Use an empty dependency array. Assume tick is defined for you.',
        language: 'tsx',
        starter: 'function Timer() {\n  useEffect(() => {\n    \n  }, []);\n  return <p>Running</p>;\n}',
        solution: 'function Timer() {\n  useEffect(() => {\n    const id = setInterval(tick, 1000);\n    return () => clearInterval(id);\n  }, []);\n  return <p>Running</p>;\n}',
        checks: [
          { label: 'Starts setInterval', pattern: String.raw`setInterval\s*\(` },
          { label: 'Returns a cleanup function', pattern: String.raw`return\s*\(?\s*\(\s*\)\s*=>` },
          { label: 'Clears the interval', pattern: String.raw`clearInterval\s*\(` },
        ],
        why: 'Anything an effect starts must be stopped in its cleanup. This stops the timer on unmount and keeps Strict Mode’s double invocation safe.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A component has useEffect(() => { console.log(\'hi\'); }, []). It re-renders five times because of state changes. How many times does “hi” log in a production build?',
        options: ['Five', 'Six', 'Zero', 'Once'],
        answer: 3,
        why: 'An empty dependency array means the effect runs after the first commit only. Re-renders do not trigger it again.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'In development, an effect logs “connect” and its cleanup logs “disconnect”. The console shows connect, disconnect, connect on mount. What is the most likely explanation?',
        options: [
          'The component was unmounted by mistake, and a bug in the code destroyed its state permanently',
          'The server rejected the first connection',
          'React Strict Mode simulated an unmount and mount to test the cleanup',
          'The effect has a missing dependency',
        ],
        answer: 2,
        why: 'Strict Mode in development runs effect, cleanup and effect again to verify the cleanup mirrors the setup. It does not happen in production builds.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Inside a component, const ref = useRef(null); with <div ref={ref} />. When is ref.current first set to the div?',
        options: [
          'During the render function, before the JSX is returned',
          'Never, refs only work in class components',
          'After the commit, so it is available inside effects',
          'Only after a second render',
        ],
        answer: 2,
        why: 'React attaches refs while committing the DOM. During the first render ref.current is still null, but effects after the commit can read the node.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A modal is rendered as {open && <Modal />}. A user types in a field inside Modal, closes it and opens it again. What is the field’s state?',
        options: [
          'The typed text is still there because React remembers it',
          'The field is empty because Modal unmounted and mounted again with fresh state',
          'The field shows the previous value only on the second open, because React caches the closed value',
          'The field throws an error',
        ],
        answer: 1,
        why: 'When open becomes false, Modal is removed and its state destroyed. Opening it again mounts a new instance with initial state.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which hook code best replaces componentDidUpdate for running something only when the prop userId changes?',
        options: [
          'useEffect(() => { load(userId); }, [userId])',
          'useEffect(() => { load(userId); }, [])',
          'useState(() => load(userId))',
          'useEffect(() => { load(userId); }) with no array and an if check inside',
        ],
        answer: 0,
        why: 'A dependency array containing userId reruns the effect only when that value changes. The empty array would run it once only.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A learner puts document.title = name directly in the component body (not in an effect). What is the most accurate comment?',
        options: [
          'It is a side effect during render, so it belongs in useEffect',
          'It is the recommended way to set the title, since the body runs once per mount',
          'It will only ever run once on mount',
          'It stops the component from re-rendering',
        ],
        answer: 0,
        why: 'Changing something outside the component during render is a side effect. Putting it in useEffect makes it run after commit, only when needed.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these happen when a component unmounts?',
        options: [
          'Its state is discarded',
          'Cleanups of its effects run',
          'Its function is called once more to build a final render',
          'Its DOM nodes are removed',
        ],
        answers: [0, 1, 3],
        why: 'Unmounting destroys state, runs effect cleanups and removes DOM nodes. React does not render a component that is going away.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which statements about useEffect(() => { … }, [id]) are true?',
        options: [
          'It runs after the first commit',
          'It runs again after any commit where id has changed',
          'Its cleanup runs before the next run of the effect',
          'It runs before the component’s first render',
        ],
        answers: [0, 1, 2],
        why: 'Effects run post-commit on mount and whenever a dependency changes, and the previous run’s cleanup always comes first. Effects never run before the first render.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'On first mount, a child component’s useEffect callback runs before its parent’s useEffect callback.',
        answer: true,
        why: 'Effects run in child-to-parent order after the commit, because a parent may rely on things its children have set up.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In development only, React’s ____ Mode runs components twice and effects an extra time to help you find impure code.',
        answer: 'Strict',
        accept: ['strict', 'StrictMode', 'Strict Mode'],
        why: 'StrictMode is a development tool. It double-invokes renders and re-runs effects, and it does nothing in production builds.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these in the order they occur when a Greeter component first appears on the page.',
        items: [
          'React calls the Greeter function and gets JSX',
          'React commits the DOM nodes to the page',
          'Refs are attached to their DOM nodes',
          'useEffect callbacks run',
        ],
        why: 'Rendering produces the description, the commit writes it to the DOM and attaches refs, and effects run last.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Consider class code: componentDidMount() { window.addEventListener(\'resize\', this.onResize); } and componentWillUnmount() { window.removeEventListener(\'resize\', this.onResize); }. How is the pair written with hooks?',
        options: [
          'useEffect(() => { window.addEventListener(\'resize\', onResize); }, []) without cleanup',
          'useEffect(() => { window.addEventListener(\'resize\', onResize); return () => window.removeEventListener(\'resize\', onResize); }, [])',
          'useState(() => window.addEventListener(\'resize\', onResize))',
          'Two separate useEffect calls where the second only removes the listener on every render',
        ],
        answer: 1,
        why: 'Setup and teardown belong together in one effect: the returned function replaces componentWillUnmount, and the empty array replaces componentDidMount.',
        difficulty: 3,
      },
    ],
  },
  'react-1': {
    summary: 'Composition builds UIs by nesting small components and passing JSX in as children or props, instead of inheriting from base components.',
    lesson: {
      minutes: 9,
      objectives: [
        'Write a container component that renders props.children and a layout component with named slot props',
        'Create a specialised component from a general one by passing props instead of using inheritance',
        'Choose between children, slot props and plain data props for a given design',
        'Predict what a composed component tree renders for given JSX',
      ],
      simple:
        'Composition means building big components by snapping small ones together, like LEGO bricks. A component can leave empty spaces, called children or slots, and the parent fills them with whatever it likes. React recommends this instead of making one component inherit from another.',
      blocks: [
        {
          type: 'text',
          title: 'What composition means',
          body:
            'Composition is combining simple components to make complex ones. You already do it whenever you put a Button inside a Form. The more powerful form is when a component does not decide everything about its contents. A Card knows how to draw a border, padding and a title bar, but it does not know what goes inside, so the parent passes the inside in. Because JSX elements are ordinary JavaScript values, they can be passed to components like any other prop. In object-oriented languages, a common reuse tool is inheritance: class B extends class A. The React team has stated that, across thousands of components at Facebook, they found no case where they would recommend inheritance for sharing UI code.',
        },
        {
          type: 'analogy',
          body:
            'A photo frame shop. The shop sells one frame design with an empty window. Customers slide in any photo: a wedding picture, a school certificate, a map. The frame does not change; the contents do. A frame that was permanently moulded around one specific photo would be useless to everyone else.',
        },
        {
          type: 'text',
          title: 'Containment: the children prop',
          body:
            'Whatever you write between a component’s opening and closing tags is passed to it as the special prop children. The component places {children} wherever it wants. Its type is React.ReactNode, which covers elements, strings, numbers, arrays and null. This is called *containment*: the component contains unknown content. Sidebar, Modal, Card, Section and Layout components all use it. Because children is just a prop, the container does not need to know anything about its contents, and the contents do not need to know where they will be shown.',
        },
        {
          type: 'text',
          title: 'Slots and specialisation',
          body:
            'Sometimes one hole is not enough. A page layout may need a header, a sidebar and a main area. Pass each as its own prop, for example header={<Logo />} and sidebar={<Menu />}. These are *slot props*: props that accept JSX and act as named holes. The second pattern is *specialisation*. Instead of writing class WelcomeDialog extends Dialog, write a WelcomeDialog function that returns <Dialog title="Welcome" message="Thank you for visiting" />. The specific component is a special case that configures the general one with props. It can even forward children. If the general component later changes, all the special ones inherit the improvement without any class hierarchy to untangle.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `import type { ReactNode } from 'react';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PageLayout(props: { header: ReactNode; sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header>{props.header}</header>
      <aside>{props.sidebar}</aside>
      <main>{props.children}</main>
    </div>
  );
}

function DeleteConfirm({ onYes }: { onYes: () => void }) {
  return (
    <Card title="Delete item?">
      <p>This cannot be undone.</p>
      <button onClick={onYes}>Delete</button>
    </Card>
  );
}`,
          caption:
            'Card shows containment: it renders title in an h2 and {children} below. PageLayout has two slot props (header and sidebar) plus children for the main area. DeleteConfirm is a specialisation: a ready-made use of Card, with its own content.',
        },
        {
          type: 'example',
          title: 'Worked example: predicting the tree',
          body:
            'Given the components above, consider <PageLayout header={<h1>NOVA</h1>} sidebar={<Menu />}><Card title="Today"><p>3 tasks</p></Card></PageLayout>. Step 1: PageLayout receives header = an h1 element, sidebar = a Menu element and children = a single Card element. Step 2: it renders a div.page. Step 3: inside, header contains the h1 “NOVA”, aside contains whatever Menu renders, and main contains {props.children}, which is the Card. Step 4: the Card renders a section with an h2 “Today” and its own children, the p “3 tasks”. The final DOM is div.page > [header > h1, aside > Menu output, main > section.card > [h2, p]]. Notice that PageLayout never mentions Card and Card never mentions PageLayout: both are reusable anywhere.',
        },
        {
          type: 'text',
          title: 'Composition also avoids deep prop passing',
          body:
            'Suppose a Page needs to give a user’s avatar to a deeply nested Header. Passing user through four layers of components that do not use it is tedious. With composition, Page can build <Avatar user={user} /> itself and hand the finished element down as a slot prop. The middle layers just pass the element along, and only Page needs to know about user. Modules later in this course cover context, but try composition first: it is simpler and keeps components independent.',
        },
        {
          type: 'compare',
          title: 'Choosing how to pass content',
          columns: ['children', 'Named slot props'],
          rows: [
            ['Best when', 'There is one main content area', 'There are several distinct regions'],
            ['Call site', 'Nested between the tags', 'Written as header={<Logo />}'],
            ['Typical component', 'Card, Modal, Section', 'PageLayout, SplitPane, Toolbar'],
            ['Type', 'ReactNode', 'ReactNode for each slot'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Composition', def: 'Building complex components by combining simpler ones and passing content in.' },
            { term: 'children', def: 'The special prop holding whatever is nested between a component’s tags.' },
            { term: 'Slot prop', def: 'A named prop that accepts JSX, such as header or footer.' },
            { term: 'Specialisation', def: 'Making a specific component by rendering a general one with particular props.' },
            { term: 'ReactNode', def: 'The TypeScript type for anything React can render: elements, text, numbers, arrays, null.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'If you find yourself writing class Special extends Base for components, stop and pass props or children instead. Inheritance makes behaviour hard to follow and hard to reuse.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body:
            'When a component has more than about five props that are all booleans or strings controlling what appears inside, consider turning some of them into children or slots.',
        },
        {
          type: 'summary',
          points: [
            'Containment: a component renders {children} so the parent decides what goes inside.',
            'Slot props such as header and sidebar give a layout several named holes.',
            'Specialisation: WelcomeDialog renders a general Dialog with fixed props, instead of extending it.',
            'Passing finished elements down can replace long chains of props that intermediate components never use.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'Which prop lets a component render whatever is nested between its opening and closing tags?',
        options: ['inner', 'slot', 'nested', 'children'],
        answer: 3,
        why: 'Anything between a component’s tags arrives as props.children. The other names do not exist as special props.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Given function Box({ children }) { return <div className="box">{children}</div>; }, what does <Box><b>Hi</b> there</Box> render?',
        options: [
          'A div with class box containing a b with Hi followed by the text there',
          'A div with class box that is empty, because children is only allowed to be a string',
          'Only the text there, since b is not allowed inside Box',
          'A div whose content is the text [object Object]',
        ],
        answer: 0,
        why: 'children holds both the b element and the text, and Box places them inside its div. Elements are renderable values.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A team has a Dialog component and needs a WelcomeDialog with a fixed title. What does React recommend?',
        options: [
          'Write class WelcomeDialog extends Dialog and override render',
          'Copy the Dialog code into a new file and edit the title',
          'Make a global variable that changes Dialog’s title whenever the welcome screen shows',
          'Write WelcomeDialog as a function that renders Dialog with specific props',
        ],
        answer: 3,
        why: 'Specialisation by composition keeps one general Dialog and configures it through props. Inheritance and copy-paste both make reuse brittle.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are valid ways to give a layout component its content?',
        options: [
          'Nest the content between its tags so it arrives as children',
          'Pass an element as a prop, e.g. sidebar={<Menu />}',
          'Extend the layout class and override a method for each region',
          'Pass a string or number as a children value',
        ],
        answers: [0, 1, 3],
        why: 'children and slot props both accept any ReactNode, including text and numbers. Inheritance is not a recommended way to fill regions in React.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'React recommends class inheritance (extends) as the standard way to share UI between components.',
        answer: false,
        why: 'React recommends composition through props and children. Inheritance hierarchies make UI code harder to follow and change.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'A prop that accepts JSX, such as header or footer, acts as a named ____ in a layout component.',
        answer: 'slot',
        accept: ['Slot', 'slots'],
        why: 'Props that take elements work as named slots, the holes a parent fills with its own content.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A Page component has user data, and a deeply nested Header needs an avatar made from it. The three middle components never use user. Which composition approach avoids passing user through them?',
        options: [
          'Make every middle component accept user and pass it on, even though they never use it',
          'Have Page create <Avatar user={user} /> and pass the element down as a slot prop',
          'Copy user into a module-level variable and mutate it',
          'Move Avatar into the middle component and import user there',
        ],
        answer: 1,
        why: 'Passing a finished element lets only Page know about user. The intermediate components simply forward the element without touching the data.',
        difficulty: 3,
      },
      {
        type: 'code',
        q: 'Write a Panel component that takes title and children and renders the title in an h2 above the children.',
        language: 'tsx',
        starter: 'function Panel({ title, children }) {\n  return (\n    \n  );\n}',
        solution: 'function Panel({ title, children }) {\n  return (\n    <section>\n      <h2>{title}</h2>\n      {children}\n    </section>\n  );\n}',
        checks: [
          { label: 'Receives title and children', pattern: String.raw`\{\s*(title\s*,\s*children|children\s*,\s*title)\s*\}` },
          { label: 'Renders the title in an h2', pattern: String.raw`<h2[^>]*>\s*\{\s*title\s*\}\s*</h2>` },
          { label: 'Renders the children', pattern: String.raw`\{\s*children\s*\}` },
        ],
        why: 'Composition in action: the parent decides what goes inside by passing children, and Panel decides the frame around them.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A Layout component is written as function Layout({ left, right }) {…}. How is it used?',
        options: [
          '<Layout><Menu /><Content /></Layout>',
          '<Layout left={<Menu />} right={<Content />} />',
          '<Layout left=Menu right=Content />',
          '<Layout.left><Menu /></Layout.left>',
        ],
        answer: 1,
        why: 'left and right are slot props, so you pass elements as attribute values inside braces. Nested children would arrive as children, which Layout ignores.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'function Frame({ children }) { return <div className="frame">{children}</div>; } is used as <Frame />, with no content between tags. What does it render?',
        options: [
          'An error, because children is required',
          'The text undefined inside the div',
          'The text children inside the div',
          'An empty div with class frame',
        ],
        answer: 3,
        why: 'When nothing is nested, children is undefined, and React renders nothing for undefined. TypeScript would only complain if the prop were typed as required.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'function Alert({ type, children }) { return <div className={"alert " + type}>{children}</div>; } Which specialised component is built by composition?',
        options: [
          'function ErrorAlert extends Alert',
          'function ErrorAlert({ children }) { return <Alert type="error">{children}</Alert>; }',
          'const ErrorAlert = Alert.prototype',
          'function ErrorAlert() { return Alert; }',
        ],
        answer: 1,
        why: 'The special component renders the general one with fixed props and forwards its children. Returning the function itself, or extending it, does not produce an element.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A page needs a header, a sidebar and a main area, each filled by different callers. Which design is the most flexible?',
        options: [
          'One component with a prop called mode that switches between hard-coded layouts',
          'A component with three boolean props: showHeader, showSidebar, showMain',
          'A layout with slot props for header and sidebar and children for main',
          'Three subclasses of a base Page class',
        ],
        answer: 2,
        why: 'Slot props and children let each caller supply any content without the layout knowing about it. Modes and booleans force the layout to grow with every new case.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which TypeScript type should you give the children prop of a Card that accepts text, elements, numbers or null?',
        options: [
          'React.ReactNode',
          'JSX.Element only',
          'string',
          'React.Component',
        ],
        answer: 0,
        why: 'ReactNode covers everything React can render. JSX.Element rejects strings and null, and string rejects elements.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A Modal is rendered as <Modal><LoginForm /></Modal>. A developer wants the modal to show a title as well. Which change keeps Modal reusable?',
        options: [
          'Hard-code the title “Login” inside Modal so every dialog shows it',
          'Replace children with a login prop',
          'Add a title prop to Modal and pass title="Login"',
          'Make LoginForm extend Modal',
        ],
        answer: 2,
        why: 'A title prop leaves Modal general, while hard-coding or inheriting ties it to one use. Children still carries the body.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are benefits of composition over inheritance for UI components?',
        options: [
          'A general component can be reused with different content',
          'Specialised components stay simple wrappers around one general component',
          'A change to the base class is automatically safe for all subclasses',
          'Components are easier to test because they depend only on props',
        ],
        answers: [0, 1, 3],
        why: 'Props-driven components are reusable, easy to wrap and test. Changes to inherited behaviour can silently break subclasses, which is a weakness of inheritance.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these could be passed as a slot prop or as children?',
        options: [
          'A JSX element such as <Logo />',
          'A string such as "Welcome"',
          'The value null, to render nothing',
          'A class declaration used for inheritance',
        ],
        answers: [0, 1, 2],
        why: 'ReactNode accepts elements, text and null. A class declaration is not renderable content.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In <Card title="A"><p>Hi</p></Card>, the p element reaches Card as props.children without Card declaring anything special.',
        answer: true,
        why: 'Any nested JSX is collected into the children prop automatically, so the component only has to render {children}.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'Making WelcomeDialog by rendering Dialog with fixed props, rather than extending it, is called ____.',
        answer: 'specialisation',
        accept: ['specialization', 'specialisation', 'specialising', 'specializing'],
        why: 'Specialisation by composition configures a general component with props to produce a specific one, without inheritance.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'Put these steps in order to evaluate <Card title="Today"><p>3 tasks</p></Card>.',
        items: [
          'React creates the p element for the nested content',
          'React calls Card with props title and children',
          'Card returns a section with an h2 and {children}',
          'The section, h2 and p are committed to the DOM',
        ],
        why: 'The nested element is created first as a value, Card receives it as children, returns its own tree, and the result is committed.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A Toolbar renders {left}{children}{right}. It is used as <Toolbar left={<Back />} right={<Menu />}><Title /></Toolbar>. In what visible order do the pieces appear?',
        options: [
          'Menu, Title, Back',
          'Title, Back, Menu',
          'Back, Title, Menu',
          'Back, Menu, Title',
        ],
        answer: 2,
        why: 'The component places its pieces in the order it writes them: left slot, then children, then right slot.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-7': {
    summary: 'The dependency array tells useEffect which values it uses, so React re-runs the effect only when one of them changes.',
    lesson: {
      minutes: 9,
      objectives: [
        'Predict when an effect runs for no array, an empty array and an array with values',
        'List every reactive value an effect uses and write its dependency array correctly',
        'Diagnose an infinite effect loop or stale value caused by wrong dependencies',
        'Fix object, array and function dependencies using primitives, functional updates or moving code out of the component',
      ],
      simple:
        'An effect is code that runs after React updates the screen. The dependency array is the list of values the effect reads. React re-runs the effect only when one of those values has changed since the last render. If you leave a value out, the effect can use out-of-date data.',
      blocks: [
        {
          type: 'text',
          title: 'What an effect is for',
          body:
            'useEffect lets a component *synchronise* with something outside React: a server, the page title, a timer, a map widget. The effect runs after React commits the screen, so it never slows the first paint. The key question is: when should it run again? React cannot read your mind, so you answer in the second argument, the dependency array. It lists the *reactive values* the effect uses: props, state, and any variable or function declared inside the component body. Values that change between renders are reactive; constants defined outside the component are not.',
        },
        {
          type: 'analogy',
          body:
            'A thermostat. It does not check the temperature constantly or only once at installation; it re-checks whenever the room temperature or the target setting changes. Those two things are its dependencies. If the thermostat forgot to watch the target, it would keep working to an old target number.',
        },
        {
          type: 'text',
          title: 'Three forms of the array',
          body:
            'With no array, the effect runs after every render. With an empty array [], it runs once after the first commit (and its cleanup runs when the component unmounts). With values, like [userId, page], it runs after the first commit and then again after any render where at least one value is different from the previous render. React compares each value with Object.is, which is like ===: numbers, strings and booleans compare by value, but objects, arrays and functions compare by reference, meaning identity in memory. Two arrays with the same contents are still different if one was created on a new render.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `function UserCard({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/users/' + userId)
      .then((r) => r.json())
      .then(setUser);
  }, [userId]);            // re-run only when userId changes

  return <p>{user ? user.name : 'Loading…'}</p>;
}

// Bug 1: a missing dependency (stale data)
//   }, []);   // fetches once, never updates for a new userId
// Bug 2: an infinite loop
//   useEffect(() => { setUser({ ...user }); });  // runs every render,
//   // setUser causes a new render, which runs the effect again`,
          caption:
            'The effect reads userId, so userId must be in the array. With [userId], navigating from user 1 to user 2 fetches again. Without it, the component shows user 1 forever. Updating state in an effect with no array creates a render–effect–render loop.',
        },
        {
          type: 'text',
          title: 'Be honest about dependencies',
          body:
            'The rule is simple: every reactive value the effect uses must be in the array. You do not choose dependencies; the code does. The eslint-plugin-react-hooks rule exhaustive-deps (included in Create React App and Vite templates) will warn about missing ones. Do not silence it. If adding a dependency causes unwanted re-runs, change the code instead. If an object is the problem, depend on the primitive you actually use, such as user.id instead of user. If you update state from its previous value, use the functional form setCount(c => c + 1) so count is no longer read. If a function is needed, move it inside the effect or outside the component, or wrap it with useCallback, which returns the same function between renders.',
        },
        {
          type: 'example',
          title: 'Worked example: tracing the runs',
          body:
            'A component has const [page, setPage] = useState(1) and useEffect(() => { document.title = \'Page \' + page; }, [page]). Render 1: page is 1, so the effect runs, setting the title to “Page 1”. A different state, say a theme toggle, changes: the component renders again but page is still 1, and Object.is(1, 1) is true, so the effect is skipped. The user clicks Next: page becomes 2, Object.is(1, 2) is false, so the effect runs and sets “Page 2”. Now see the object trap: const options = { limit: 10 }; useEffect(() => load(options), [options]). Each render creates a new options object, so Object.is is false every time and the effect runs on every render, even though the contents are identical. The fix is to depend on limit (a number) or to define options outside the component.',
        },
        {
          type: 'compare',
          title: 'The dependency array forms',
          columns: ['Runs after first commit?', 'Runs again when'],
          rows: [
            ['Omitted', 'Yes', 'After every render'],
            ['[]', 'Yes', 'Never (cleanup runs on unmount)'],
            ['[a, b]', 'Yes', 'a or b differs from the previous render'],
            ['[obj], new object each render', 'Yes', 'After every render, because the reference always changes'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Dependency array', def: 'The second argument of useEffect listing the reactive values the effect reads.' },
            { term: 'Reactive value', def: 'A prop, state or variable declared in the component body that can change between renders.' },
            { term: 'Object.is', def: 'The comparison React uses to decide if a dependency changed; objects compare by reference.' },
            { term: 'Stale value', def: 'An outdated value an effect still sees because its dependency was left out of the array.' },
            { term: 'exhaustive-deps', def: 'An ESLint rule that warns when an effect uses a value missing from its array.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Never fix an infinite loop by deleting a dependency to “make it stop”. That hides the bug and creates stale values. Find why the dependency changes on every render, and fix that.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body:
            'Before writing an effect, ask whether you need one. Values that can be calculated from props and state belong in the render body, and reactions to a click belong in the event handler.',
        },
        {
          type: 'summary',
          points: [
            'No array runs after every render, [] runs after the first commit only, and [a, b] runs when a or b changes.',
            'Every reactive value the effect reads must be listed; the lint rule exhaustive-deps catches omissions.',
            'React compares dependencies with Object.is, so new objects, arrays or functions on every render re-run the effect.',
            'Fix noisy dependencies by using primitives, functional state updates, or moving values out of the component, not by removing dependencies.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A component has useEffect(() => { console.log(\'ran\'); }, [count]). count goes 0 → 0 (re-render for another reason) → 1. How many times is “ran” logged in total, including the first mount?',
        options: ['One', 'Three', 'Two', 'Zero'],
        answer: 2,
        why: 'It runs after mount, is skipped when count stays 0 (Object.is(0, 0) is true), and runs again when count becomes 1, giving two logs.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'useEffect(() => { fetchUser(id); }, []); The user clicks to view a different id, but the old user stays on screen. What is the cause?',
        options: [
          'fetchUser cannot be called inside useEffect, so the request never fires at all',
          'Empty arrays make React cache every request forever',
          'The effect uses id, but id is missing from the dependency array',
          'The component must call fetchUser in the render body',
        ],
        answer: 2,
        why: 'An effect that reads id must list it. With [], the effect runs once for the first id and never re-runs when id changes.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const filters = { tag: \'news\' }; useEffect(() => { load(filters); }, [filters]); inside a component. How often does the effect run?',
        options: [
          'Only on mount, because the object never changes content between renders',
          'After every render, because filters is a new object each time',
          'Never, because objects cannot be dependencies',
          'Only when the tag text is edited',
        ],
        answer: 1,
        why: 'The object literal is recreated on every render and Object.is compares objects by reference, so React sees a change every time.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'Which of these must be listed in the dependency array of an effect that uses them?',
        options: [
          'A prop used inside the effect',
          'A state variable used inside the effect',
          'A constant declared outside the component and never changed',
          'A function declared inside the component body and called by the effect',
        ],
        answers: [0, 1, 3],
        why: 'Props, state and functions defined during render are reactive values because they can change between renders. A module-level constant is not reactive.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'useEffect(() => { setTotal(total + 1); }) with no dependency array will run once and then stop.',
        answer: false,
        why: 'With no array the effect runs after every render. setTotal triggers a new render, so the effect runs again and again, creating an infinite loop.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To make an effect run only once after the first commit, pass an empty ____ as its second argument.',
        answer: 'array',
        accept: ['dependency array', 'Array', 'brackets', '[]'],
        why: 'The second argument is the dependency array. With no values in it, nothing can change, so the effect runs after mount only.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'This effect should add 1 to count every second without listing count: setInterval(() => setCount(count + 1), 1000) inside useEffect(…, []). The counter stops at 1. Which fix keeps the empty array correct?',
        options: [
          'Add a second setInterval that also increments count, so it catches up',
          'Use setCount(c => c + 1) so count is not read inside the effect',
          'Change the array to [count] and remove the cleanup',
          'Delete the array so it runs after every render',
        ],
        answer: 1,
        why: 'The interval callback captured count = 0 on the first render, so it always sets 1. The functional update reads the latest value without making count a dependency.',
        difficulty: 3,
      },
      {
        type: 'code',
        q: 'Write a useEffect that sets document.title to the text "Hello, " followed by name, and re-runs only when name changes.',
        language: 'tsx',
        starter: 'function Hello({ name }: { name: string }) {\n  \n  return <h1>Hello, {name}</h1>;\n}',
        solution: 'function Hello({ name }: { name: string }) {\n  useEffect(() => {\n    document.title = \'Hello, \' + name;\n  }, [name]);\n  return <h1>Hello, {name}</h1>;\n}',
        checks: [
          { label: 'Calls useEffect', pattern: String.raw`useEffect\s*\(` },
          { label: 'Sets document.title', pattern: String.raw`document\.title\s*=` },
          { label: 'Lists name as the dependency', pattern: String.raw`\[\s*name\s*\]\s*\)` },
        ],
        why: 'The effect reads name, so name is its dependency. Putting document.title inside the effect keeps the render body free of side effects.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A search component has const [q, setQ] = useState(\'\') and useEffect(() => { search(q); }, [q]). If the user types “cat”, how many times does the effect run after mount, assuming one render per keystroke?',
        options: ['Three, once per changed character', 'One, after the last character', 'Zero', 'Four'],
        answer: 0,
        why: 'q changes from “” to “c”, “ca” and “cat”, so the effect runs three times after the mount run. Debouncing is a separate technique.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which dependency array is correct for useEffect(() => { track(user.id, page); }, …) when user is an object prop that is recreated each render?',
        options: ['[user, page]', '[user.id, page]', '[]', '[page]'],
        answer: 1,
        why: 'The effect uses user.id and page, so listing those primitives re-runs only when they actually change. [user] would re-run each render.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'The lint rule exhaustive-deps warns: “React Hook useEffect has a missing dependency: \'theme\'”. What should you do?',
        options: [
          'Add an eslint-disable comment so the warning stops',
          'Remove theme from the effect without checking',
          'Add theme to the array, or change the code so it does not need theme',
          'Move the effect to the top of the file, outside the component, where hooks run safely',
        ],
        answer: 2,
        why: 'The warning points to a possible stale value. Either include the dependency or restructure the code; suppressing the warning hides a real bug.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'function Chart({ data }) { const options = { animate: true }; useEffect(() => draw(data, options), [data, options]); } The chart redraws on every render. Which fix is best?',
        options: [
          'Remove data from the array',
          'Define options outside the component (or inline it inside the effect)',
          'Wrap draw in a setTimeout',
          'Add one more dependency, such as a counter, so the effect runs less often',
        ],
        answer: 1,
        why: 'The options object is new each render. Moving it outside the component, or inside the effect, makes it stable so it is no longer a changing dependency.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which statement about an effect with an omitted dependency array is true?',
        options: [
          'It runs once and then stops',
          'It runs only when state or props change, never on mount',
          'It never runs in production',
          'It runs after every render of the component',
        ],
        answer: 3,
        why: 'Without an array React has no information about what the effect depends on, so it re-runs after every commit.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A learner writes useEffect(() => { setCount(count + 1); }, [count]); and the counter races upward forever. Why?',
        options: [
          'Each run changes count, which is its own dependency, causing another run',
          'setCount cannot be called inside effects',
          'Empty arrays are always required for state updates',
          'React ignores dependencies for primitive values and only compares object identity',
        ],
        answer: 0,
        why: 'The effect updates the very value it depends on, so every run triggers a re-render, a changed dependency and another run.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these changes can stop an effect from re-running on every render because of an object or function dependency?',
        options: [
          'Depend on the primitive values you actually read, such as user.id',
          'Move the object or function outside the component if it uses no props or state',
          'Delete the dependency from the array without changing the code',
          'Wrap the function in useCallback so its identity is stable between renders',
        ],
        answers: [0, 1, 3],
        why: 'Stable primitives, module-level values and memoised functions all keep dependencies unchanged. Deleting a dependency while the effect still reads it creates stale values.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'Which statements about Object.is-based dependency comparison are true?',
        options: [
          'Two different arrays with the same contents are treated as different',
          'The number 5 followed by the number 5 is treated as unchanged',
          'A string whose characters changed is treated as unchanged',
          'The same object reference on both renders is treated as unchanged',
        ],
        answers: [0, 1, 3],
        why: 'Primitives compare by value and objects compare by reference. A string that changed is a different value.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A value declared outside the component, for example const API = \'/api\' at module level, does not need to be in a dependency array.',
        answer: true,
        why: 'Module-level constants never change between renders, so they are not reactive values and the linter does not require them.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The ESLint rule that warns when an effect uses a value missing from its array is called react-hooks/____-deps.',
        answer: 'exhaustive',
        accept: ['Exhaustive'],
        why: 'The exhaustive-deps rule checks every reactive value used inside an effect against its dependency array.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these in order for an effect with [page] when the user clicks Next, changing page from 1 to 2.',
        items: [
          'setPage(2) is called',
          'The component re-renders with page = 2',
          'React compares the new page with the previous page',
          'The changed dependency makes React run the effect after the commit',
        ],
        why: 'A state change triggers a render, React compares dependencies with Object.is, and a difference schedules the effect after the commit.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'An effect reads user.name inside its body but its array is [seconds]. After user.name changes, the effect keeps using the old name. What is this problem called?',
        options: [
          'A race condition',
          'A stale closure from a missing dependency',
          'A memory leak',
          'A hydration mismatch between server and client markup',
        ],
        answer: 1,
        why: 'The effect captured user.name from an earlier render because the value was not listed, so it keeps using out-of-date data until the listed dependency changes.',
        difficulty: 3,
      },
    ],
  },
  'react-gen-8': {
    summary: 'A cleanup function returned from useEffect undoes the effect’s setup before it re-runs and when the component unmounts.',
    lesson: {
      minutes: 9,
      objectives: [
        'State exactly when a cleanup function runs and which render’s values it sees',
        'Write cleanups for timers, event listeners and subscriptions',
        'Prevent a stale-response race condition in a fetch effect using an ignore flag or AbortController',
        'Explain why Strict Mode’s extra setup–cleanup–setup cycle is a useful test',
      ],
      simple:
        'If an effect starts something that keeps going, like a timer or a listener, it must also stop it. You do this by returning a function from the effect. React calls that function before running the effect again and when the component disappears, so nothing is left running by accident.',
      blocks: [
        {
          type: 'text',
          title: 'Why cleanup exists',
          body:
            'Some effects start things that do not stop by themselves: a setInterval timer, a window event listener, a WebSocket connection, a subscription to a data store. If a component disappears and the timer keeps ticking, it will try to update something that no longer exists. That wastes memory (a *memory leak*), can fire duplicate handlers and sometimes shows wrong data. The remedy is a cleanup function: the function you return from the effect. Its job is to undo whatever the effect set up, so the effect and its cleanup form a matched pair, like opening and closing a door.',
        },
        {
          type: 'analogy',
          body:
            'Switching on a geyser or a tap before a bath. If you leave and forget to turn it off, it keeps running and wastes water. Cleanup is the habit of turning it off as you walk out, and also when you move to a different bathroom, because the old tap should not keep running either.',
        },
        {
          type: 'text',
          title: 'When cleanup runs',
          body:
            'React calls the cleanup in two situations. First, before the effect runs again because a dependency changed: React cleans up the old effect, then runs the new one. Second, when the component unmounts. The cleanup does not run after the very first render, because nothing has been set up yet. Importantly, each cleanup is a closure from the render that created it, so it sees the props and state of *that* render. When roomId changes from “a” to “b”, the cleanup for “a” runs with roomId = “a”, which means it can disconnect from exactly the room it connected to.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `function Chat({ roomId }: { roomId: string }) {
  useEffect(() => {
    const conn = createConnection(roomId);   // setup
    conn.connect();
    return () => conn.disconnect();          // cleanup
  }, [roomId]);
  return <h1>Room: {roomId}</h1>;
}

function Resize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return <p>{width}px</p>;
}`,
          caption:
            'Chat connects to a room and disconnects when roomId changes or the component unmounts. Resize adds a window listener once and removes the same function in the cleanup. The listener must be the very same function object for removal to work, which is why onResize is a named const.',
        },
        {
          type: 'text',
          title: 'Race conditions in data fetching',
          body:
            'Cleanup is also how you handle *race conditions*: situations where the result depends on which of two asynchronous operations finishes first. Suppose a user clicks user 1 and then quickly user 2. Two requests are in flight. If the response for user 1 arrives last, it would overwrite the data for user 2 and the screen would show the wrong person. Fix it by making the cleanup mark the old request as stale. Set a local flag ignore = false in the effect, set it to true in the cleanup, and only call setState if the flag is still false. A more complete option is an AbortController: call controller.abort() in the cleanup, which cancels the network request itself.',
        },
        {
          type: 'code',
          language: 'tsx',
          code: `useEffect(() => {
  let ignore = false;
  const controller = new AbortController();

  fetch('/api/users/' + userId, { signal: controller.signal })
    .then((r) => r.json())
    .then((data) => {
      if (!ignore) setUser(data);
    })
    .catch((err) => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => {
    ignore = true;
    controller.abort();
  };
}, [userId]);`,
          caption:
            'ignore is a variable private to this run of the effect. When userId changes, the cleanup sets it to true so the old response is discarded. The controller cancels the request, and the catch block ignores the AbortError that cancellation raises.',
        },
        {
          type: 'example',
          title: 'Worked example: a timeline for Chat',
          body:
            'The Chat component above starts with roomId = “general”. Mount: render “general”, commit, setup runs and connects to “general”. The user switches to “sports”. React renders with roomId = “sports”, commits the new heading, then runs the cleanup from the previous render (which disconnects from “general”), then runs the new setup (which connects to “sports”). The user leaves the page. The component unmounts, so React runs the last cleanup and disconnects from “sports”. At no moment are two connections open for the user. Total: 2 connects, 2 disconnects. In development with Strict Mode, the first mount additionally does connect → disconnect → connect, so you would see 3 connects and 3 disconnects. If you forgot the cleanup, the console would show connections piling up, which is exactly how Strict Mode reveals the bug.',
        },
        {
          type: 'steps',
          title: 'Checklist for writing an effect',
          steps: [
            'Decide what the effect starts: a timer, listener, request or connection.',
            'Write the setup code, using the values from this render.',
            'Return a function that stops or undoes exactly what the setup started.',
            'List every reactive value the setup uses in the dependency array.',
            'Test by changing a dependency and unmounting: nothing should be left running.',
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Cleanup function', def: 'The function returned from useEffect that undoes the effect’s setup.' },
            { term: 'Memory leak', def: 'Memory that is never released because something, like a listener, is still attached.' },
            { term: 'Race condition', def: 'A bug where the outcome depends on which asynchronous task finishes first.' },
            { term: 'AbortController', def: 'A browser API that cancels a fetch request through its signal.' },
            { term: 'Subscription', def: 'A live link to a data source that keeps sending updates until it is cancelled.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body:
            'Do not write window.addEventListener(\'resize\', () => …) and then try to remove a different arrow function. removeEventListener needs the same function reference that was added.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body:
            'React’s Strict Mode in development runs setup, cleanup and setup again on mount. If this causes a visible problem, such as two connections, it is telling you the cleanup is missing or wrong.',
        },
        {
          type: 'summary',
          points: [
            'The function returned from an effect is its cleanup; it runs before the effect re-runs and when the component unmounts.',
            'Every timer, listener, subscription or connection started in an effect needs a matching stop in the cleanup.',
            'Each cleanup sees the values from the render that created it, so it can undo exactly what that run set up.',
            'Use an ignore flag or AbortController in the cleanup of fetch effects to stop stale responses from overwriting newer data.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []); When does clearInterval(id) run in a production build?',
        options: [
          'After every re-render of the component',
          'Before the effect runs for the first time',
          'Each second when the interval fires',
          'When the component unmounts',
        ],
        answer: 3,
        why: 'With an empty array the effect has no reason to re-run, so its cleanup runs once, on unmount. It never runs before the first setup.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Chat has useEffect(() => { const c = connect(roomId); return () => c.disconnect(); }, [roomId]). roomId changes from “a” to “b”. What is the order of events?',
        options: [
          'Connect to b, then disconnect from a',
          'Disconnect from a (using a’s values), then connect to b',
          'Disconnect from b, then connect to a',
          'Only connect to b; the old connection closes by itself when the room changes',
        ],
        answer: 1,
        why: 'Before running the new effect React runs the previous effect’s cleanup, which closes over roomId = “a”, then runs the setup for “b”.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A component adds window.addEventListener(\'scroll\', () => setY(window.scrollY)) in an effect with no cleanup. After the component is unmounted and mounted again several times, what is the likely result?',
        options: [
          'Nothing; React removes all listeners automatically when the next render happens',
          'Several leftover listeners run on every scroll, wasting work and risking bugs',
          'The scroll event stops firing in the browser',
          'The component can no longer be mounted',
        ],
        answer: 1,
        why: 'React does not remove listeners you added. Each mount leaves another one attached, so handlers pile up. A cleanup that calls removeEventListener prevents this.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these effects need a cleanup function?',
        options: [
          'Starting a setInterval timer',
          'Subscribing to a WebSocket or store',
          'Adding a resize listener to window',
          'Setting document.title to a string',
        ],
        answers: [0, 1, 2],
        why: 'Timers, subscriptions and listeners keep running until stopped. Setting document.title is a one-off write and nothing continues afterwards.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A cleanup function runs after the very first render of a component, before any effect has run.',
        answer: false,
        why: 'Cleanup undoes a previous setup, so on the first mount there is nothing to clean up. It first runs before the effect re-runs or when the component unmounts.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To discard a stale fetch response when userId changes, the cleanup can set a local ____ variable that the then-callback checks before calling setState.',
        answer: 'ignore',
        accept: ['flag', 'cancelled', 'canceled', 'ignore flag'],
        why: 'A local flag such as ignore is set to true in the cleanup, so a late response from the old request is skipped.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A user clicks product 1, then product 2 quickly. The product 1 response arrives after the product 2 response, and the page shows product 1’s data under product 2’s title. What kind of bug is this?',
        options: [
          'A syntax error in the fetch URL that only shows up for fast clicks',
          'A hydration mismatch between server and client markup',
          'A race condition between two in-flight requests',
          'A missing key warning',
        ],
        answer: 2,
        why: 'The result depends on which request finishes last. A cleanup with an ignore flag or AbortController makes the older response harmless.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Complete the effect so that it adds a keydown listener to window, calling the handler onKey, and removes the same listener in the cleanup. The array should be empty.',
        language: 'tsx',
        starter: 'useEffect(() => {\n  \n}, []);',
        solution: 'useEffect(() => {\n  window.addEventListener(\'keydown\', onKey);\n  return () => window.removeEventListener(\'keydown\', onKey);\n}, []);',
        checks: [
          { label: 'Adds a keydown listener', pattern: String.raw`addEventListener\s*\(\s*['"]keydown['"]\s*,\s*onKey` },
          { label: 'Returns a cleanup', pattern: String.raw`return\s*\(?\s*\(\s*\)\s*=>` },
          { label: 'Removes the same listener', pattern: String.raw`removeEventListener\s*\(\s*['"]keydown['"]\s*,\s*onKey` },
        ],
        why: 'The cleanup undoes the setup using the same event name and the same function reference, so nothing remains attached after unmount.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'In development with Strict Mode, an effect logs “connect” and its cleanup logs “disconnect”. What sequence appears on first mount?',
        options: [
          'connect, connect',
          'disconnect, connect',
          'connect only',
          'connect, disconnect, connect',
        ],
        answer: 3,
        why: 'Strict Mode simulates an unmount and mount to test that cleanup properly reverses setup. The result is setup, cleanup, setup.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A learner writes: window.addEventListener(\'resize\', () => draw()); in the effect and return () => window.removeEventListener(\'resize\', () => draw()); in the cleanup. What happens?',
        options: [
          'The listener is removed correctly',
          'The listener stays attached, because the removed function is a different object',
          'React throws an error during cleanup because the listener was never registered',
          'The listener is removed and then added again',
        ],
        answer: 1,
        why: 'removeEventListener matches by function reference. Two separately written arrow functions are different objects, so the original remains.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which cleanup correctly stops a fetch request when the effect re-runs?',
        options: [
          'return () => setLoading(false)',
          'return () => fetch.stop()',
          'return () => controller.abort()',
          'return () => response.close()',
        ],
        answer: 2,
        why: 'Create const controller = new AbortController(), pass controller.signal to fetch, and call controller.abort() in the cleanup to cancel the request.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A timer effect is written as useEffect(() => { const id = setInterval(tick, 1000); }, []); with no return. The component is removed from the page. What is the issue?',
        options: [
          'The timer keeps running after unmount',
          'React stops the timer automatically when the component unmounts',
          'The timer never starts',
          'The component cannot be removed',
        ],
        answer: 0,
        why: 'Without clearInterval in a cleanup, the timer runs forever, keeps the closure in memory and may call setState on a component that no longer exists.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'An effect with [userId] has a cleanup. userId changes from 7 to 8. Which values does the cleanup see when it runs?',
        options: [
          'userId = 8, because cleanup runs after the new render has committed',
          'userId = undefined',
          'The latest props of the component at any time',
          'userId = 7, the values from the render that created that effect',
        ],
        answer: 3,
        why: 'The cleanup is a closure over the render in which its effect was created. It therefore sees userId = 7 even though the component now renders with 8.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which effect needs no cleanup function at all?',
        options: [
          'useEffect(() => { document.title = name; }, [name])',
          'useEffect(() => { const s = store.subscribe(fn); … }, [])',
          'useEffect(() => { const t = setTimeout(go, 5000); … }, [])',
          'useEffect(() => { ws.connect(); … }, [])',
        ],
        answer: 0,
        why: 'Assigning to document.title is a single write that leaves nothing running. Subscriptions, pending timeouts and connections must be cancelled.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'When does React run an effect’s cleanup function?',
        options: [
          'Before the effect re-runs after a dependency changed',
          'When the component unmounts',
          'Immediately before the very first run of the effect',
          'Every time any state in the app changes',
        ],
        answers: [0, 1],
        why: 'Cleanup always precedes a re-run and also happens on unmount. It does not run before the first setup and is not tied to unrelated state.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which patterns reduce the chance of showing stale fetch results?',
        options: [
          'Set an ignore flag to true in the cleanup and check it before setState',
          'Abort the request with AbortController in the cleanup',
          'Leave the dependency array empty even if the URL uses a prop',
          'Include the changing value, such as userId, in the dependency array',
        ],
        answers: [0, 1, 3],
        why: 'A flag or abort discards old responses, and a correct dependency array makes the effect re-run for the new value. An empty array would never fetch again.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'If Strict Mode’s extra setup–cleanup–setup cycle makes your app open two connections at once, the likely cause is a missing or incorrect cleanup.',
        answer: true,
        why: 'Strict Mode simulates a remount. A correct cleanup closes the first connection, so only one stays open; leftover connections show a cleanup bug.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The built-in browser object used to cancel a fetch request from an effect cleanup is the ____ API (AbortController).',
        answer: 'abort',
        accept: ['Abort', 'AbortController', 'abort controller'],
        why: 'AbortController provides a signal for fetch and an abort() method that cancels the request.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'A Chat effect depends on roomId. Put these in order when roomId changes from “a” to “b”.',
        items: [
          'The component re-renders with roomId “b”',
          'The new heading is committed to the DOM',
          'The cleanup from the “a” effect runs',
          'The effect runs again and connects to “b”',
        ],
        why: 'Render and commit come first, then React cleans up the previous effect, and finally runs the new effect with the new value.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A Clock component runs setInterval(() => setTime(new Date()), 1000) in an effect with [] and a cleanup that calls clearInterval. The page mounts it, unmounts it, and mounts it again. How many intervals are running at the end?',
        options: ['Two', 'Zero', 'Three', 'One'],
        answer: 3,
        why: 'The first interval was cleared on unmount, then the second mount started one new interval. With a correct cleanup only the latest one remains.',
        difficulty: 2,
      },
    ],
  },
};

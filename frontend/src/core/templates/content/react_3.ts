import type { TopicContent } from './types';

/** Advanced React Patterns — modules 10–13: in-depth lessons, lesson quizzes and practice pools. */
export const react3Content: Record<string, TopicContent> = {
  'react-4': {
    summary: 'Memoisation means remembering the result of earlier work so React can skip it when nothing relevant has changed.',
    lesson: {
      minutes: 7,
      objectives: [
        'Explain why a React component re-renders and which of those re-renders are wasted work.',
        'Choose between React.memo, useMemo and useCallback for a given slow spot.',
        'Predict whether a memoised child will skip a render by checking its props for new object or function identities.',
        'Use the React Profiler to measure a render before and after optimising.',
      ],
      simple: 'Memoisation is remembering an answer so you do not redo the sum when nothing changed. React gives you three tools: React.memo remembers a component’s output, useMemo remembers a calculated value, and useCallback remembers a function. Measure first, because remembering also costs a little time and memory.',
      blocks: [
        {
          type: 'text',
          title: 'Why React re-renders so much',
          body: 'A component function runs again, a *re-render*, whenever its state changes, its context changes, or its parent re-renders. That last rule surprises beginners: when a parent re-renders, every child component below it runs again too, even if the props it receives are exactly the same. Most of the time this is perfectly fine, because React is fast and the work is tiny. But imagine a product page where typing in a search box re-renders a table of 2,000 rows on every keystroke. Now the wasted work is noticeable and the typing feels laggy. Memoisation is the family of tools that lets you skip repeated work in such cases.',
        },
        {
          type: 'analogy',
          body: 'Think of a tea stall owner who remembers that Ramesh always takes “one cutting chai, less sugar”. When Ramesh walks up, she does not ask again; she just makes it. Only if Ramesh changes his order does she think afresh. Memoisation is that memory: same input as last time, reuse the earlier answer. The cost is that she must keep remembering every regular, and a stall with too many regulars to remember slows down instead.',
        },
        {
          type: 'text',
          title: 'Three tools, three different things to remember',
          body: 'React.memo wraps a *component* and remembers its rendered output. If the next props are shallowly equal to the previous props, React skips calling the component at all. useMemo remembers a *value* computed inside a component, such as a filtered and sorted list, and only recomputes it when its dependency array changes. useCallback remembers a *function* so the same function object is handed back on each render until a dependency changes. All three use the same idea: compare the new inputs with the old inputs, and reuse the old result when they match.',
        },
        {
          type: 'text',
          title: 'Referential equality: the hidden trap',
          body: 'In JavaScript, two objects with the same contents are still different objects: {} === {} is false, and so is (() => {}) === (() => {}). “Shallow equality” compares each prop with ===. So if a parent creates a fresh object, array or function on every render and passes it down, the child sees a “changed” prop each time, and React.memo can never skip. This is why the three tools are usually used together: useCallback and useMemo keep the identity of a function or object stable so that React.memo on the child can actually work.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'Three tools working together. useMemo keeps the filtered array until items or query change; useCallback keeps the same onSelect function between renders; React.memo lets Row skip rendering when id, label and onSelect are all unchanged.',
          code: `import { memo, useCallback, useMemo, useState } from 'react';

const Row = memo(function Row(props: {
  id: number; label: string; onSelect: (id: number) => void;
}) {
  return <li onClick={() => props.onSelect(props.id)}>{props.label}</li>;
});

export function List({ items }: { items: { id: number; label: string }[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<number | null>(null);

  const visible = useMemo(
    () => items.filter((i) => i.label.includes(query)),
    [items, query],
  );
  const onSelect = useCallback((id: number) => setActive(id), []);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>{visible.map((i) => <Row key={i.id} {...i} onSelect={onSelect} />)}</ul>
    </>
  );
}`,
        },
        {
          type: 'example',
          title: 'Worked example: reading a Profiler result',
          body: 'A team’s dashboard has a Chart component that takes 40 ms to render and sits next to a clock that updates every second. In the React DevTools Profiler they record five seconds and see Chart rendering 5 times, 40 ms each, so 200 ms of work, although its data never changed. They wrap Chart in React.memo, but the Profiler still shows 5 renders. Why? The parent passes options={ { smooth: true } }, a brand-new object each time. They move the object outside the component (or wrap it in useMemo with an empty dependency array). Re-recording shows Chart rendering once, then “Did not render” for the next four ticks. The work drops from 200 ms to 40 ms, and they know the fix worked because they measured before and after.',
        },
        {
          type: 'steps',
          title: 'A safe optimising routine',
          steps: [
            'Notice a real problem: a slow interaction, a janky input, or a Profiler flame graph with a long bar.',
            'Record a Profiler session and find which component renders often or slowly, and why it rendered.',
            'Fix the cheapest cause first: move state down, split the component, or avoid creating new objects needlessly.',
            'Only then apply React.memo, useMemo or useCallback to exactly that spot.',
            'Record again and keep the change only if the numbers improved.',
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Memoisation', def: 'Caching the result of work, keyed by its inputs, so identical inputs reuse the old result.' },
            { term: 'React.memo', def: 'A wrapper that makes a component skip re-rendering when its props are shallowly equal to last time.' },
            { term: 'useMemo', def: 'A hook that caches a computed value until a value in its dependency array changes.' },
            { term: 'useCallback', def: 'A hook that returns the same function object between renders until a dependency changes.' },
            { term: 'Referential equality', def: 'Two references being the very same object in memory, as tested by ===.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Memoisation has a cost: React stores the previous result and compares dependencies on every render. Wrapping every component “just in case” can make an app slower and harder to read. Measure first, and memoise only what is measurably slow.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body: 'The React team is also building the React Compiler, a build-time tool that inserts this kind of memoisation automatically. Even so, understanding what it does helps you read profiler output and debug why something still re-renders.',
        },
        {
          type: 'summary',
          points: [
            'A parent re-render re-renders all its children by default, even when their props are identical.',
            'React.memo skips a component, useMemo caches a value, and useCallback caches a function.',
            'New object, array or function props on every render defeat React.memo because shallow equality uses ===.',
            'Always measure with the Profiler before and after; unnecessary memoisation costs time and clarity.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A parent component holds a counter in state and renders <Report data={rows} /> where rows never changes and Report is not memoised. The counter button is clicked. What happens to Report?',
        options: ['It re-renders only if rows is an array', 'It skips rendering, because rows is unchanged', 'It re-renders, because its parent re-rendered and Report is not memoised', 'It unmounts and mounts again'],
        answer: 2,
        why: 'Without React.memo, a child re-renders whenever its parent does, regardless of whether props changed. The counter state belongs to the parent, so Report runs again.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which tool is the best fit for caching the result of sorting a 5,000-item array inside a component?',
        options: ['useMemo', 'React.memo', 'useCallback', 'useRef'],
        answer: 0,
        why: 'useMemo caches a computed value, here the sorted array. useCallback caches a function, and React.memo caches a component’s rendered output.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'const Chart = React.memo(ChartImpl); The parent renders <Chart style={ { color: "red" } } /> and re-renders every second. Chart still re-renders each second. Why?',
        options: ['React.memo only works on class components, so a function component is always re-rendered', 'The color string "red" is mutable', 'Chart needs a key prop to be memoised', 'The style prop is a new object each render, so shallow comparison fails'],
        answer: 3,
        why: 'The inline object literal is a different object every render, so props are never === equal. Hoisting the object or wrapping it in useMemo restores the skip.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are sensible steps before adding React.memo to a slow screen?',
        options: [
          'Record a Profiler session to find the slow component',
          'Wrap every component in React.memo to be safe',
          'Check whether state can move closer to the component that uses it',
          'Compare Profiler timings after the change',
          'Add useCallback to every function in the file',
        ],
        answers: [0, 2, 3],
        why: 'Measure, fix cheap structural causes such as state placement, then verify the gain. Blanket memoisation adds comparison cost and clutter without evidence.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'React.memo compares props with a deep comparison, so two different arrays with identical contents count as equal props.',
        answer: false,
        why: 'React.memo performs a shallow comparison using ===. Two separate arrays with equal contents are different references, so the component re-renders.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'Two objects with identical contents but created separately are not ____ equal, because === compares memory references.',
        answer: 'referentially',
        accept: ['referential', 'by reference', 'reference'],
        why: 'Referential equality asks whether both values point to the very same object. Memoisation tools depend on it, so unstable identities cause wasted renders.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'Put these performance-tuning steps in a sensible order.',
        items: [
          'Notice a slow interaction',
          'Record a Profiler session',
          'Identify the component rendering needlessly',
          'Apply memoisation to that spot',
          'Record again and compare',
        ],
        why: 'Optimising is an experiment: observe, locate, change one thing, and check the result. Skipping the measurement at either end means guessing.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Memoise total so the reduce runs only when items changes. Use the useMemo hook.',
        language: 'tsx',
        starter: 'const total = items.reduce((sum, i) => sum + i.price, 0);',
        solution: 'const total = useMemo(\n  () => items.reduce((sum, i) => sum + i.price, 0),\n  [items],\n);',
        checks: [
          { label: 'Wraps the work in useMemo', pattern: String.raw`useMemo\s*\(\s*\(\s*\)\s*=>` },
          { label: 'Depends on items', pattern: String.raw`\[\s*items\s*\]` },
        ],
        why: 'useMemo takes a function that returns the value and a dependency array. With [items], the reduce is skipped on renders where items is the same array.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A search page re-renders a 3,000-row table on every keystroke in the search box. The table receives only the rows prop, which does not change while typing. Which change is the most direct fix?',
        options: ['Replace the input with an uncontrolled input only', 'Wrap the table component in React.memo', 'Add useCallback around the table’s JSX', 'Store the rows in a ref'],
        answer: 1,
        why: 'The table’s props are unchanged during typing, so React.memo lets React skip it. useCallback caches functions, not elements, and a ref would stop updates when rows really change.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which statement about useCallback(fn, []) is correct?',
        options: ['It returns the same function object on every render', 'It runs fn once and caches the return value', 'It prevents fn from ever seeing new state', 'It makes the component skip re-rendering'],
        answer: 0,
        why: 'useCallback caches the function itself, not its result. With an empty dependency array it can capture stale values, and it does not stop re-renders on its own.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A Profiler recording shows a memoised Card re-rendering every time, with the note that its props changed. Its parent passes tags={["new", "sale"]}. What is the likeliest cause?',
        options: ['Arrays cannot be passed to memoised components because React.memo rejects non-primitive props', 'React.memo ignores array props', 'The array literal is a fresh array on each parent render', 'Card is missing a displayName'],
        answer: 2,
        why: 'The literal ["new", "sale"] creates a new array each render, so shallow equality sees a changed prop. Hoist it to a constant or wrap it in useMemo.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A developer wraps all 60 components of a small to-do app in React.memo and adds useMemo to every variable. What is the most likely result?',
        options: ['The app becomes dramatically faster because every component now skips all of its renders', 'Little gain, extra comparison work and harder-to-read code', 'React refuses to compile the code', 'All state updates stop working'],
        answer: 1,
        why: 'Each memoised piece costs memory and a comparison on every render. For cheap components the cost can exceed the savings, so measure first.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which parent code lets a memoised child skip renders when the parent re-renders for unrelated reasons?',
        options: [
          'const style = { gap: 8 }; (declared inside the parent) and <Child style={style} />',
          'const style = { gap: 8 }; (declared outside the component) and <Child style={style} />',
          'const style = { gap: 8 }; (declared inside the parent and wrapped in Object.freeze) and <Child style={style} />',
          '<Child style={JSON.parse("{\\"gap\\":8}")} />',
        ],
        answer: 1,
        why: 'An object declared outside the component is created once, so its identity never changes. The other forms create a new object during each parent render.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'Which of these props would break a React.memo child’s ability to skip rendering if created inline in the parent on each render?',
        options: ['An arrow function such as onClick={() => save()}', 'An object literal such as style={ { margin: 4 } }', 'A string such as title="Home"', 'An array literal such as ids={[1, 2, 3]}', 'A number such as count={5}'],
        answers: [0, 1, 3],
        why: 'Functions, objects and arrays get a new identity every render. Strings and numbers are compared by value, so identical ones count as equal.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are legitimate reasons to reach for memoisation?',
        options: [
          'A Profiler recording shows a heavy chart re-rendering with unchanged props',
          'A filter over 20,000 records runs on every unrelated state change',
          'A component renders a single paragraph of text',
          'You want to prevent your own state updates from ever re-rendering the component',
        ],
        answers: [0, 1],
        why: 'Memoisation helps with measurably heavy renders or calculations that repeat with the same inputs. It does not stop a component re-rendering for its own state changes.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Calling useMemo(() => compute(a), [a]) guarantees that compute will never run again while the component stays mounted.',
        answer: false,
        why: 'useMemo recomputes whenever a changes, and React may also discard cached values, for example to free memory. Treat it as a performance hint, not a guarantee.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'A child component re-renders when its parent re-renders, even if the child receives no props at all, unless the child is wrapped in React.memo.',
        answer: true,
        why: 'Re-rendering flows down the tree by default. React.memo adds a prop comparison; with zero props it always compares equal and so skips.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'In React DevTools, the ____ tab records renders and shows why each component rendered and how long it took.',
        answer: 'Profiler',
        accept: ['profiler tab', 'react profiler'],
        why: 'The Profiler tab records commits, flame graphs and render durations. It is the tool to use before deciding what to memoise.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each memoisation tool to what it remembers.',
        pairs: [
          ['React.memo', 'A component’s rendered output, keyed by its props'],
          ['useMemo', 'A computed value, keyed by a dependency array'],
          ['useCallback', 'A function object, keyed by a dependency array'],
          ['Profiler', 'Not a cache: it measures how long renders take'],
        ],
        why: 'The three tools cache different things using the same compare-then-reuse idea. The Profiler only measures, so you know where memoising will help.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a function component Badge, wrapped with React.memo, that receives a label string prop and returns <span>{label}</span>. Use the memo function imported from react or called as React.memo.',
        language: 'tsx',
        starter: 'function Badge({ label }: { label: string }) {\n  return <span>{label}</span>;\n}',
        solution: 'const Badge = React.memo(function Badge({ label }: { label: string }) {\n  return <span>{label}</span>;\n});',
        checks: [
          { label: 'Uses memo', pattern: String.raw`\bmemo\s*\(` },
          { label: 'Renders the label in a span', pattern: String.raw`<span>\s*\{\s*label\s*\}\s*</span>` },
        ],
        why: 'Wrapping the component function with memo makes React compare props shallowly and skip the render when label is unchanged.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-17': {
    summary: 'React.memo wraps a component so React skips re-rendering it when its props are shallowly equal to the previous props.',
    lesson: {
      minutes: 8,
      objectives: [
        'Predict whether a React.memo component will skip a render, given the old and new props.',
        'Explain what a shallow comparison checks and why inline objects, arrays and functions defeat it.',
        'Diagnose why a memoised component still re-renders because of its own state, context or children prop.',
        'Write a custom comparison function for React.memo and judge when it is worth doing.',
      ],
      simple: 'React.memo is a wrapper that says: “only run this component again if its props really changed.” React checks each prop with a simple same-or-not test. If every prop is the same as last time, the old result is reused and the component is skipped.',
      blocks: [
        {
          type: 'text',
          title: 'The default: parents drag children along',
          body: 'In the previous topic, Memoisation, you saw that a re-render of a parent re-renders all its children. For a small badge or button this costs almost nothing. For a component that draws a 500-point chart or a long list, it costs real milliseconds. React.memo is the component-level fix. You wrap a component once, and from then on React remembers the props from its last render. On the next parent render, React compares the new props with the remembered props. If nothing differs, React does not call your component function again and reuses the previous output.',
        },
        {
          type: 'analogy',
          body: 'A bank clerk gets a cheque with the same account number, same amount and same date as one she cleared a minute ago. She does not redo the whole verification; she looks at the earlier slip and stamps it the same way. But if even one detail differs, she processes it fully. React.memo is this clerk: it checks the details (props) and reuses the earlier result only if every detail matches.',
        },
        {
          type: 'text',
          title: 'What “shallow” comparison really means',
          body: 'React compares props one by one using Object.is, which behaves like === for our purposes. Strings, numbers and booleans compare by value, so "Home" equals "Home" and 5 equals 5. Objects, arrays and functions compare by identity, meaning whether it is the very same object in memory. So an inline style object, an inline array, or an inline arrow function creates a new identity on each parent render, and the comparison says “changed” even though the contents are identical. The fix is to keep identities stable: declare constants outside the component, or use useMemo and useCallback (covered in the next topic, useMemo and useCallback).',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'Left unmemoised, Price re-renders on every tick of the clock. Wrapped in memo, it re-renders only when amount or currency change. The commented line shows the common trap: an inline object prop would be new on every tick and defeat memo.',
          code: `import { memo, useEffect, useState } from 'react';

const Price = memo(function Price(props: { amount: number; currency: string }) {
  console.log('Price rendered');
  return <b>{props.currency} {props.amount.toFixed(2)}</b>;
});

export function Header() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header>
      <span>{now.toLocaleTimeString()}</span>
      <Price amount={499} currency="₹" />
      {/* <Price amount={499} currency="₹" tax={ { rate: 18 } } />  new object each tick */}
    </header>
  );
}`,
        },
        {
          type: 'text',
          title: 'What React.memo does not stop',
          body: 'React.memo only guards against re-renders caused by a parent. It does not block three other triggers. First, a memoised component’s own state: calling its setState still re-renders it. Second, context: if it calls useContext, a change in that context value re-renders it regardless of props (see the Context API topic). Third, the children prop: JSX like <Card><p>Hi</p></Card> creates a new React element object for the children on every parent render, so a memoised Card receiving children as a prop sees a changed prop each time. If the children are static, define them once outside or memoise them with useMemo.',
        },
        {
          type: 'text',
          title: 'Custom comparison and when to skip it',
          body: 'memo accepts an optional second argument, a function (prev, next) that returns true when the props should be treated as equal. For instance, you might compare only item.id and item.version rather than the whole item object. Use this sparingly. A wrong comparison creates stale screens that are hard to debug, because the component silently ignores a prop that did change. Prefer fixing the identity problem at its source in the parent. Also remember that the check itself takes time, so memo pays off for components that are expensive to render or that re-render very often with identical props.',
        },
        {
          type: 'example',
          title: 'Worked example: will it skip?',
          body: 'A Row is wrapped in memo. On render 1 the parent passes label="Pen", count=3, onBuy=buy where buy is created inside the parent. On render 2 the parent re-renders because of an unrelated search box. Compare: label "Pen" equals "Pen", count 3 equals 3, but buy is a new function object each render, so the comparison fails and Row re-renders. Fix 1: wrap buy with useCallback. Fix 2: if buy needs no component data, move it outside the component. After the fix, all three props are identical, and in the Profiler Row is greyed out as “Did not render”. If instead the count changes from 3 to 4, memo correctly lets Row re-render, because its output would differ.',
        },
        {
          type: 'compare',
          title: 'Plain component vs memoised component',
          columns: ['Plain component', 'React.memo component'],
          rows: [
            ['Parent re-renders, props same', 'Re-renders anyway', 'Skipped'],
            ['Props change by identity (new object)', 'Re-renders', 'Re-renders'],
            ['Own state changes', 'Re-renders', 'Re-renders'],
            ['Context value changes', 'Re-renders', 'Re-renders'],
            ['Extra cost per render', 'None', 'A shallow props comparison'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Shallow comparison', def: 'Comparing each prop with Object.is (like ===), without looking inside objects or arrays.' },
            { term: 'Stable identity', def: 'A value that is the same object across renders, so === says it has not changed.' },
            { term: 'Custom comparator', def: 'The optional second argument to memo, returning true when old and new props should count as equal.' },
            { term: 'Wasted render', def: 'A render whose output is identical to the previous one, so it did no useful work.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'A common mistake: wrapping a child in memo but still passing it a fresh arrow function such as onClick={() => save(id)}. The memo wrapper then never skips, and you pay for the comparison with no benefit. Check the Profiler’s “why did this render” reason before assuming memo works.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Give memoised components a name (a named function inside memo, as in the code above). It makes the Profiler and DevTools show “Price” instead of “Anonymous”, which saves time when hunting wasted renders.',
        },
        {
          type: 'summary',
          points: [
            'React.memo skips a component when every prop is Object.is-equal to the previous render’s prop.',
            'Primitives compare by value; objects, arrays and functions compare by identity and need stable references.',
            'Own state, context changes and a fresh children element still re-render a memoised component.',
            'A custom comparator can help but risks stale UI; fix identities at the source first.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'const Tag = memo(TagImpl); The parent renders <Tag name="Sale" count={2} /> and re-renders for unrelated reasons. Compared with the previous render, name and count are identical. What happens to Tag?',
        options: ['It re-renders, because every parent render forces children to run', 'It is skipped only if it also has a key', 'It re-renders once, then is skipped from then on', 'It is skipped, because the props are shallowly equal'],
        answer: 3,
        why: 'memo compares each prop; "Sale" equals "Sale" and 2 equals 2, so React reuses the previous output without calling Tag.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A memoised Row receives onDelete={() => remove(id)} written inline in the parent. Row still re-renders on every parent render. What is the most appropriate fix?',
        options: ['Replace memo with useMemo around Row, since useMemo is the hook that caches components between renders', 'Convert the function into a string prop', 'Add an empty dependency array to memo', 'Stabilise the function with useCallback, or pass id and let Row call remove'],
        answer: 3,
        why: 'The inline arrow function is a new identity every render, so shallow comparison fails. Keeping the function stable, or passing plain data instead, lets memo skip.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A memoised Profile calls useContext(ThemeContext). The theme changes from "light" to "dark" while its props stay the same. What does React do?',
        options: ['Skips Profile, since props are unchanged', 'Re-renders Profile, because context changes bypass memo', 'Throws an error, because components wrapped in memo are not allowed to read any context', 'Re-renders only Profile’s parent'],
        answer: 1,
        why: 'React.memo only compares props. A component subscribed to a context re-renders whenever that context value changes.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these will still cause a React.memo component to re-render?',
        options: [
          'Its own useState setter is called with a new value',
          'The parent re-renders and passes identical string and number props',
          'A context it reads via useContext changes value',
          'The parent passes a new inline object as a prop each render',
        ],
        answers: [0, 2, 3],
        why: 'memo guards only against unchanged props. Own state, subscribed context and changed-identity props all legitimately trigger a render, while identical primitives let it skip.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Passing <Card><p>Static note</p></Card> to a memoised Card never causes a re-render, because the text inside never changes.',
        answer: false,
        why: 'The JSX creates a new React element object for children on every parent render, so the children prop has a new identity and memo’s comparison fails.',
        difficulty: 3,
      },
      {
        type: 'fill',
        q: 'React.memo compares props using a ____ comparison, checking each prop with Object.is rather than inspecting inside objects.',
        answer: 'shallow',
        accept: ['shallow equality', 'shallow-equal'],
        why: 'A shallow comparison looks only one level deep. Two arrays with the same contents but different identities count as different.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which parent code gives a memoised Chart the best chance of being skipped when the parent re-renders because of an unrelated timer?',
        options: ['<Chart data={rows.map((r) => r)} />', '<Chart data={[...rows]} /> where rows comes from useState', '<Chart data={rows} /> where rows comes straight from useState', '<Chart data={JSON.parse(JSON.stringify(rows))} />'],
        answer: 2,
        why: 'The state array keeps its identity until it is set again. map, spread and JSON round-trips all build a brand-new array during each render.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Export a component Avatar that is memoised with React.memo. It takes a url string prop and returns an img element using it as src. Use memo(...) around a function.',
        language: 'tsx',
        starter: 'export function Avatar({ url }: { url: string }) {\n  return <img src={url} />;\n}',
        solution: 'export const Avatar = memo(function Avatar({ url }: { url: string }) {\n  return <img src={url} alt="" />;\n});',
        checks: [
          { label: 'Wraps the component with memo', pattern: String.raw`\bmemo\s*\(` },
          { label: 'Uses the url prop as src', pattern: String.raw`src\s*=\s*\{\s*(props\.)?url\s*\}` },
        ],
        why: 'Wrapping the function in memo makes React skip it whenever url is unchanged. The src attribute still reads the url prop.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A memoised Item takes item={ { id: 7, name: "Tea" } } written inline in the parent. How can Item be made skippable without changing what it displays?',
        options: ['Move the object outside the component, or pass id and name as separate primitive props', 'Wrap the object in Object.freeze inline, since a frozen object is treated as the same value on every render', 'Rename the prop to data', 'Add a key to the object'],
        answer: 0,
        why: 'A constant created once, or primitive props, keep stable values across renders. Freezing an inline object still creates a new one each time.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const Row = memo(RowImpl, (prev, next) => prev.item.id === next.item.id); The parent later passes the same id but with item.price changed from 40 to 45. What is shown?',
        options: ['The new price, since memo falls back to comparing every prop whenever a custom comparator exists', 'An error because the comparator is invalid', 'The old price, since the comparator says the props are equal', 'The new price after a second render'],
        answer: 2,
        why: 'The comparator returns true (equal) when ids match, so React skips the render and the stale price stays on screen. Custom comparators must cover every prop that affects output.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'In the Profiler a memoised Sidebar shows “Props changed: onToggle” on every parent render. Where should you look first?',
        options: ['At how the parent creates the onToggle function each render', 'At the package.json React version', 'At the CSS file for Sidebar', 'At whether Sidebar uses a class name, since memo compares className strings by reference'],
        answer: 0,
        why: 'The Profiler is pointing at a prop whose identity changes. An inline function in the parent is the usual cause, fixed with useCallback or by moving the function.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A memoised Counter has const [n, setN] = useState(0) inside it and a button that calls setN(n + 1). The parent never re-renders. What happens on each click?',
        options: ['Counter re-renders only on even clicks', 'Nothing, because memo blocks every update to the component including its own state changes', 'The parent is forced to re-render', 'Counter re-renders, because its own state changed'],
        answer: 3,
        why: 'memo only compares props coming from the parent. A component’s own state updates always trigger its own re-render.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which component is the best candidate for React.memo?',
        options: ['A single static footer line of text', 'A heavy table of 800 rows inside a page whose header clock ticks each second', 'A component whose props change on every render anyway, since memo would then skip it most often', 'A component rendered exactly once at startup'],
        answer: 1,
        why: 'memo pays off when a component is expensive and its parent re-renders often with unchanged props. The table matches both conditions; the others gain little or nothing.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these props are compared by value (so identical ones do NOT defeat React.memo)?',
        options: ['A string such as "Pune"', 'A number such as 18', 'A boolean such as true', 'An inline array [1, 2]', 'An inline arrow function'],
        answers: [0, 1, 2],
        why: 'Strings, numbers and booleans are primitives, so Object.is compares their values. Arrays and functions compare by identity.',
        difficulty: 1,
      },
      {
        type: 'multi',
        q: 'A memoised List still re-renders on each parent render. Which of these could be the cause?',
        options: [
          'The parent passes columns={["id", "name"]} as an inline array',
          'The parent passes children JSX such as <List><Empty /></List>',
          'The parent passes pageSize={20} unchanged',
          'The parent passes onSort={() => sort()} inline',
        ],
        answers: [0, 1, 3],
        why: 'An inline array, a fresh children element and an inline function all get a new identity per render. The numeric 20 is equal every time.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Adding React.memo to a component is free: it can only make an app faster or leave it unchanged.',
        answer: false,
        why: 'Every render of the parent triggers a props comparison and the component keeps its previous props in memory. If the props change almost every time, you pay that cost and never skip.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'When one prop of a memoised component changes, React renders it normally with the new props instead of reusing the cached output.',
        answer: true,
        why: 'memo only skips renders whose inputs have not changed. Any changed prop means the output may differ, so the component function runs again.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To make a memoised component show up as “Price” in React DevTools, write the wrapped component as a ____ function instead of an anonymous arrow.',
        answer: 'named',
        accept: ['name', 'named function'],
        why: 'A named function gives DevTools and the Profiler a display name, which makes finding wasted renders much easier.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'Put these steps in the order React performs them when a parent re-renders and a memoised child is present.',
        items: [
          'Parent function runs and creates the new props',
          'React compares each new prop with the previous one',
          'All props equal: reuse the previous output',
          'Any prop different: call the child function again',
        ],
        why: 'The parent always runs first. React then does the shallow comparison and either reuses the old result or re-renders the child.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Complete the second argument so that Row is treated as unchanged when prev.id equals next.id. Write memo(function Row(...) {...}, (prev, next) => ...).',
        language: 'tsx',
        starter: 'const Row = memo(function Row(props: { id: number; label: string }) {\n  return <li>{props.label}</li>;\n});',
        solution: 'const Row = memo(function Row(props: { id: number; label: string }) {\n  return <li>{props.label}</li>;\n}, (prev, next) => prev.id === next.id);',
        checks: [
          { label: 'Has a comparator with prev and next', pattern: String.raw`\(\s*prev\w*\s*,\s*next\w*\s*\)\s*=>` },
          { label: 'Compares ids with ===', pattern: String.raw`prev\w*\.id\s*===\s*next\w*\.id` },
        ],
        why: 'The comparator returns true to mean “props are equal, skip the render”. Here only the id decides, which is risky if label can change independently.',
        difficulty: 3,
      },
    ],
  },
  'react-gen-18': {
    summary: 'useMemo caches a calculated value and useCallback caches a function, both recomputed only when their dependency arrays change.',
    lesson: {
      minutes: 8,
      objectives: [
        'Write useMemo and useCallback calls with correct dependency arrays.',
        'Predict when a cached value or function is reused and when it is recreated.',
        'Fix a stale-closure bug caused by a missing dependency, for example with a functional state update.',
        'Decide whether a given calculation or function is worth caching.',
      ],
      simple: 'useMemo remembers the result of a calculation, and useCallback remembers a function, until something listed in their dependency array changes. You use them to avoid repeating slow work and to hand the same function to a memoised child each time. They are tools for measured problems, not for every line.',
      blocks: [
        {
          type: 'text',
          title: 'Two hooks, one idea',
          body: 'You already know from React.memo that a component can skip rendering when its props are the same. Two problems remain. First, some calculations inside a component are slow, such as filtering and sorting 20,000 records, and they run again on every render, even when the inputs did not change. Second, functions and objects you create inside a component are new on every render, which quietly breaks React.memo on children. useMemo solves the first problem and also the second for objects; useCallback solves it for functions. Both take a function and a dependency array, and both reuse the previous result while every dependency is unchanged.',
        },
        {
          type: 'analogy',
          body: 'Suppose you cook a big pot of dal on Sunday and note on the lid: “made with 2 cups lentils, 6 cups water”. On Monday, if you want the same dal, you just reheat it. Only if the recipe changes, say 3 cups of lentils, do you cook again. The dependency array is that note on the lid: same note, reuse the pot; different note, cook fresh. useMemo keeps the dal (a value); useCallback keeps the recipe card itself (a function).',
        },
        {
          type: 'text',
          title: 'useMemo: caching a value',
          body: 'Write const visible = useMemo(() => compute(a, b), [a, b]). On the first render React calls your function and stores the result. On later renders React compares a and b with their previous values using Object.is. If both are unchanged it returns the stored result without calling your function. If either changed, it calls the function again and stores the new result. Important detail: you pass the function that computes the value, not the value. The array must list every reactive value (props, state, variables from the component body) that the function reads. React’s eslint rule react-hooks/exhaustive-deps checks this for you.',
        },
        {
          type: 'text',
          title: 'useCallback: caching a function',
          body: 'useCallback(fn, deps) is essentially useMemo(() => fn, deps): it returns the same function object across renders until a dependency changes. By itself it does not make anything faster, because creating a function is cheap. Its value comes from identity. Pass a stable function to a React.memo child, or list it in a useEffect dependency array, and the child or effect no longer sees a “new” function on every render. If the child is not memoised and the effect does not depend on the function, useCallback does nothing useful.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'visible is recomputed only when products or minRating change. addToCart is the same function object every render because it uses the functional form setCart(prev => ...), which means it needs no dependencies. Because ProductCard is memoised, typing in the unrelated note field no longer re-renders the cards.',
          code: `import { memo, useCallback, useMemo, useState } from 'react';

type Product = { id: number; name: string; rating: number };

const ProductCard = memo(function ProductCard(props: {
  product: Product; onAdd: (id: number) => void;
}) {
  return <button onClick={() => props.onAdd(props.product.id)}>{props.product.name}</button>;
});

export function Shop({ products, minRating }: { products: Product[]; minRating: number }) {
  const [cart, setCart] = useState<number[]>([]);
  const [note, setNote] = useState('');

  const visible = useMemo(
    () => products.filter((p) => p.rating >= minRating).sort((a, b) => b.rating - a.rating),
    [products, minRating],
  );
  const addToCart = useCallback((id: number) => setCart((prev) => [...prev, id]), []);

  return (
    <>
      <input value={note} onChange={(e) => setNote(e.target.value)} />
      <p>Cart: {cart.length}</p>
      {visible.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
    </>
  );
}`,
        },
        {
          type: 'text',
          title: 'The stale-closure trap',
          body: 'A cached function remembers the variables from the render in which it was created. If you forget a dependency, the function keeps using the old value. For example useCallback(() => setCount(count + 1), []) always sees count as 0, so the counter sticks at 1. There are two fixes. Add count to the array, which creates a new function whenever count changes. Or use the functional update setCount(c => c + 1), which does not read count at all, so the array can stay empty. The second fix keeps the function stable and is usually better.',
        },
        {
          type: 'example',
          title: 'Worked example: do we need useMemo here?',
          body: 'A component sorts 50 products on each render. A quick console.time test shows the sort takes 0.1 ms. Caching it saves almost nothing, and adds a dependency array to maintain, so leave it alone. Now another component filters 50,000 log lines on each render; console.time shows 45 ms, which exceeds a 16 ms frame budget at 60 frames per second and makes typing stutter. Here useMemo with [logs, level] is justified: the 45 ms is paid only when logs or level change. A third case: the component builds const opts = { sort: "asc" } and passes it to a memoised Table. The calculation is trivial, but caching opts with useMemo (or hoisting it outside the component) gives Table a stable prop, so memo works. Same hook, three different verdicts.',
        },
        {
          type: 'compare',
          title: 'useMemo vs useCallback',
          columns: ['useMemo', 'useCallback'],
          rows: [
            ['What it caches', 'The value returned by your function', 'The function itself'],
            ['Typical use', 'Slow filter, sort or derived object', 'Handler passed to a memoised child or effect'],
            ['Equivalent form', 'useMemo(() => value, deps)', 'useMemo(() => fn, deps)'],
            ['Runs your function?', 'Yes, when deps change', 'No, it only stores it; you call it later'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Dependency array', def: 'The list of values that, when any changes, makes the hook recompute or recreate its result.' },
            { term: 'Stale closure', def: 'A function that still uses variable values from an earlier render because a dependency was left out.' },
            { term: 'Functional update', def: 'Calling setState with a function such as setCount(c => c + 1), so the latest state is read without a dependency.' },
            { term: 'exhaustive-deps', def: 'An ESLint rule that warns when a hook’s dependency array misses a value the callback uses.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Do not use useMemo to make your program correct. React may discard cached values and recompute them (for example to free memory), so your code must still work if the function runs again. Treat the cache as a speed-up only, never as a place to store state.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Before reaching for useMemo, try the cheaper fixes: move the slow work to a smaller component, lift constant objects out of the component, or reduce the data. These often remove the need for caching entirely.',
        },
        {
          type: 'summary',
          points: [
            'useMemo(() => value, deps) caches a computed value; useCallback(fn, deps) caches the function object.',
            'List every reactive value used inside the callback; a missing one creates a stale closure.',
            'A functional state update (setX(prev => ...)) lets a cached handler have an empty dependency array.',
            'useCallback matters only when a stable identity feeds a memoised child or an effect dependency.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'const total = useMemo(() => sum(items), [items]); The component re-renders because an unrelated state variable changed, and items is the same array as before. What happens?',
        options: ['sum is skipped and the cached total from the last render is returned', 'sum runs again, because every render recomputes it', 'React throws a dependency warning', 'total becomes undefined until items changes'],
        answer: 0,
        why: 'Object.is says items is unchanged, so React returns the stored result without calling the function.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'const inc = useCallback(() => setCount(count + 1), []); A button calls inc three times over three renders, starting from count = 0. What does count end at?',
        options: ['3', '0', '1', '2'],
        answer: 2,
        why: 'The empty array freezes the first render’s count (0), so each call sets count to 0 + 1 = 1. Using setCount(c => c + 1) or listing count fixes it.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A child is NOT wrapped in React.memo, and the parent wraps the handler in useCallback before passing it down. What is the likely effect on rendering?',
        options: ['The child now skips renders', 'The child re-renders as before; the cached function gains nothing', 'The parent stops re-rendering, because useCallback blocks its own updates from running', 'The handler runs once only'],
        answer: 1,
        why: 'Without memo the child re-renders whenever the parent does, whatever the identity of its props. useCallback helps only where something compares identities.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are good reasons to use useMemo?',
        options: [
          'Filtering 40,000 rows takes about 30 ms and runs on each keystroke',
          'Building an options object that is passed to a memoised child',
          'Storing a value that must survive between renders as component state',
          'Adding two small numbers each render',
        ],
        answers: [0, 1],
        why: 'useMemo suits measurably slow work and stabilising an object for a memoised child. It is not storage for state, and trivial sums are cheaper to repeat than to cache.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'useCallback(fn, []) makes fn run faster because React compiles the cached function.',
        answer: false,
        why: 'useCallback only returns the same function object between renders; it does not change how fast the function runs. Its benefit is a stable identity.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To keep a handler stable without listing count in its dependencies, write setCount(c => c + 1), a ____ update.',
        answer: 'functional',
        accept: ['function', 'functional form', 'updater'],
        why: 'The updater function receives the latest state, so the handler never needs to read count from its closure.',
        difficulty: 2,
      },
      {
        type: 'match',
        q: 'Match each hook call to what it returns.',
        pairs: [
          ['useMemo(() => 6 * 7, [])', 'The number 42, cached'],
          ['useCallback(() => 6 * 7, [])', 'A function, cached, not yet called'],
          ['useState(6 * 7)', 'A state value and its setter'],
          ['useRef(6 * 7)', 'A mutable box holding 42'],
        ],
        why: 'useMemo runs the function and caches its result, while useCallback caches the function itself. useState and useRef store values with different update behaviour.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Wrap this handler in useCallback so the same function is reused between renders. It uses the functional update, so the dependency array should be empty.',
        language: 'tsx',
        starter: 'const increment = () => setCount((c) => c + 1);',
        solution: 'const increment = useCallback(() => setCount((c) => c + 1), []);',
        checks: [
          { label: 'Wraps in useCallback', pattern: String.raw`useCallback\s*\(` },
          { label: 'Keeps the functional update', pattern: String.raw`setCount\s*\(\s*\(?\s*\w+\s*\)?\s*=>` },
          { label: 'Uses an empty dependency array', pattern: String.raw`\[\s*\]\s*\)` },
        ],
        why: 'The functional update reads the latest count itself, so no dependency is needed and the function identity stays stable.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'const sorted = useMemo(() => items.sort(byPrice), [items]); The list on screen changes order, but the original props array is also reordered. What is the problem?',
        options: ['useMemo cannot sort', 'sorted must be a ref', 'The dependency should be byPrice, because useMemo reruns only when the comparator changes', 'sort mutates the items array; copy it first with [...items].sort'],
        answer: 3,
        why: 'Array.prototype.sort changes the array in place, mutating props. Sort a copy so the cached calculation is pure.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'useEffect(() => { load(userId); }, [load]); where const load = (id) => fetch("/api/" + id) is defined inside the component. The effect fires on every render. Which fix is best?',
        options: ['Add a setTimeout', 'Remove the dependency array', 'Replace useEffect with useMemo, because useMemo runs the fetch only when needed', 'Wrap load in useCallback with the right dependencies'],
        answer: 3,
        why: 'load is a new function each render, so the effect dependency changes every time. A stable load from useCallback, or moving it outside the component, stops that.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const r = useMemo(() => expensive(a, b), [a]); Later b changes while a stays the same. What does r hold?',
        options: ['A fresh result using the new b, because React reruns the callback when any variable changes', 'The old result, since b is missing from the dependencies', 'undefined', 'An error is thrown'],
        answer: 1,
        why: 'React compares only the listed dependencies. Leaving b out causes a stale result, which the exhaustive-deps lint rule would flag.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A calculation takes 0.05 ms per render and the component renders 10 times per second. What is the sensible decision about useMemo?',
        options: ['Add it, since all calculations should be cached', 'Add it with an empty dependency array', 'Skip it; 0.5 ms of work per second is too small to matter', 'Move the calculation into useEffect'],
        answer: 2,
        why: 'At 0.05 ms the saved time is negligible and the hook adds comparison overhead and code. Cache only measured slow work.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which statement about useMemo(() => compute(x), [x]) is correct?',
        options: ['The stored value may be dropped, so compute must be safe to run again', 'The cache is permanent until unmount, so compute can safely hold one-time side effects', 'compute runs on each render regardless', 'x must be an object'],
        answer: 0,
        why: 'React treats the cache as an optimisation and may recompute. Your code must stay correct even if compute runs more than once.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'A memoised child still re-renders even though the parent uses useCallback for its handler. Which could be the cause?',
        options: [
          'The handler’s dependency array contains a value that changes each render',
          'The parent also passes an inline object prop',
          'The handler is used in an onClick, so memo is disabled',
          'The child reads a context whose value changed',
        ],
        answers: [0, 1, 3],
        why: 'An unstable dependency recreates the handler, an inline object is a new prop, and a changed context always re-renders. Using it in onClick has no effect on memo.',
        difficulty: 3,
      },
      {
        type: 'multi',
        q: 'Which of these calls produce a value that keeps the same identity across renders while its dependencies are unchanged?',
        options: ['useMemo(() => ({ a: 1 }), [])', 'useCallback(() => 1, [])', 'const o = { a: 1 }', 'const f = () => 1'],
        answers: [0, 1],
        why: 'useMemo and useCallback return their stored result while dependencies match. Plain object and function declarations inside the component are recreated on every render.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'useMemo(() => fn, deps) and useCallback(fn, deps) return equivalent results.',
        answer: true,
        why: 'useCallback is a convenience for the common case of memoising a function; both return the cached function object while dependencies stay the same.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'It is fine to leave a variable out of the dependency array if you are sure it rarely changes.',
        answer: false,
        why: 'Skipping a used variable creates a stale closure whenever it does change, and the bug is hard to spot. List every value the callback reads.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The ESLint rule react-hooks/____-deps reports a missing dependency in a hook call.',
        answer: 'exhaustive',
        accept: ['exhaustive deps'],
        why: 'exhaustive-deps checks every value used inside the callback against the dependency array and warns about anything missing.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these steps in order for deciding to cache a slow calculation.',
        items: [
          'Measure the calculation time',
          'Try a cheaper fix such as splitting the component',
          'Wrap the calculation in useMemo with its dependencies',
          'Re-measure to confirm the gain',
        ],
        why: 'Measure first to confirm there is a problem, try structural fixes, cache as a last step, and verify the result.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write a useMemo call that stores in doubled a new array with every number in nums multiplied by 2, recomputed only when nums changes.',
        language: 'tsx',
        starter: 'const doubled = nums.map((n) => n * 2);',
        solution: 'const doubled = useMemo(() => nums.map((n) => n * 2), [nums]);',
        checks: [
          { label: 'Uses useMemo', pattern: String.raw`useMemo\s*\(\s*\(\s*\)\s*=>` },
          { label: 'Maps with n * 2', pattern: String.raw`\.map\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\s*\*\s*2` },
          { label: 'Depends on nums', pattern: String.raw`\[\s*nums\s*\]` },
        ],
        why: 'useMemo takes a function returning the value and a dependency array. With [nums], map runs only when the array changes.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-19': {
    summary: 'Redux keeps shared state in one store that changes only through dispatched actions and pure reducers, made short by Redux Toolkit.',
    lesson: {
      minutes: 8,
      objectives: [
        'Trace one-way data flow in Redux: UI event, dispatch, reducer, new state, re-render.',
        'Write a Redux Toolkit slice with createSlice and register it with configureStore.',
        'Read state with useSelector and send actions with useDispatch in a component.',
        'Judge whether a piece of state belongs in Redux or in local state or context.',
      ],
      simple: 'Redux keeps important shared data in one central store. Components never change that data directly; they send a small message called an action, and a reducer function works out the new data. This makes every change easy to trace, which helps in big apps.',
      blocks: [
        {
          type: 'text',
          title: 'Why a store at all?',
          body: 'In the Context API and prop-drilling topics you saw how to share state between distant components. Context works well for slow-changing values such as a theme. In a large app, such as a shopping site with a cart, user profile, notifications and filters, many components read and write the same data, and tracking who changed what becomes hard. Redux answers this by putting shared state in a single *store* and allowing only one way to change it. Today the recommended way to write Redux is Redux Toolkit (RTK), the official package that removes most of the old boilerplate.',
        },
        {
          type: 'analogy',
          body: 'Think of a bank branch. The ledger (the store) sits behind the counter. You, the customer (a component), cannot write in it. You fill in a slip, “deposit ₹500 to account 12” (an action), and hand it to the clerk. The clerk (the reducer) follows fixed rules and writes a new ledger entry. Everyone sees the same ledger, and every change has a slip that explains it. If something looks wrong, you read the slips.',
        },
        {
          type: 'text',
          title: 'The four pieces and one-way flow',
          body: 'A Redux app has four parts. The *store* holds the whole state tree. An *action* is a plain object describing what happened, for example { type: "cart/added", payload: 42 }. A *reducer* is a pure function (state, action) → newState: it must not mutate the old state, call APIs or use random values. The *dispatch* function sends an action to the store. The flow is always one-way: a user clicks, the component dispatches an action, the store runs the reducer, the new state is saved, and subscribed components re-render with the fresh data. Because reducers are pure, you can replay actions in the Redux DevTools and even time-travel.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'createSlice builds the reducer and the action creators together; inside it you may write “mutating” code like state.items.push because RTK uses Immer to turn it into an immutable update. configureStore combines slices into the store, and Provider makes the store available to all components. useSelector reads one piece of state, and useDispatch returns the dispatch function.',
          code: `import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { Provider, useDispatch, useSelector } from 'react-redux';

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as number[] },
  reducers: {
    added(state, action: PayloadAction<number>) {
      state.items.push(action.payload);
    },
    cleared(state) {
      state.items = [];
    },
  },
});
export const { added, cleared } = cartSlice.actions;

const store = configureStore({ reducer: { cart: cartSlice.reducer } });
type RootState = ReturnType<typeof store.getState>;

function CartBadge() {
  const count = useSelector((s: RootState) => s.cart.items.length);
  const dispatch = useDispatch();
  return <button onClick={() => dispatch(added(42))}>Cart ({count})</button>;
}

export const App = () => <Provider store={store}><CartBadge /></Provider>;`,
        },
        {
          type: 'text',
          title: 'Selectors, immutability and async work',
          body: 'A *selector* is a function that picks data from the state, such as s => s.cart.items.length. useSelector re-renders the component only when the selected value changes (compared with ===), so select the smallest piece you need. If a selector returns a new array or object each time, it re-renders on every store update; this is where the memoisation ideas from the previous module matter. Reducers must be pure, so side effects such as fetching data live elsewhere. RTK provides createAsyncThunk for this: you write an async function, and RTK dispatches pending, fulfilled and rejected actions for your slice to handle. For server data many teams now use RTK Query, which is built into Toolkit.',
        },
        {
          type: 'example',
          title: 'Worked example: tracing one click',
          body: 'The cart starts as { items: [] }. The user clicks “Cart (0)”. Step 1: onClick runs dispatch(added(42)). Step 2: added(42) builds the action { type: "cart/added", payload: 42 }. Step 3: the store calls cartSlice.reducer with the current state and this action. Step 4: the reducer’s added case runs state.items.push(42); Immer records the change and produces a new state { items: [42] } and leaves the old object untouched. Step 5: the store saves it and notifies subscribers. Step 6: useSelector runs s.cart.items.length, gets 1 instead of 0, and the badge re-renders as “Cart (1)”. A different component that selects only s.user.name sees the same name and does not re-render.',
        },
        {
          type: 'steps',
          title: 'Setting up Redux Toolkit in an app',
          steps: [
            'Install @reduxjs/toolkit and react-redux.',
            'Write one slice per feature with createSlice (name, initialState, reducers).',
            'Combine the slice reducers in configureStore({ reducer: { ... } }).',
            'Wrap the app in <Provider store={store}>.',
            'In components, read with useSelector and write with useDispatch.',
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Store', def: 'The single object that holds the whole application state and lets you dispatch actions.' },
            { term: 'Action', def: 'A plain object with a type (and usually a payload) describing something that happened.' },
            { term: 'Reducer', def: 'A pure function (state, action) → newState that must not mutate state or cause side effects.' },
            { term: 'Slice', def: 'One feature’s piece of state, together with its reducers and generated action creators.' },
            { term: 'Selector', def: 'A function that reads the part of the state a component needs.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Outside createSlice, never mutate state. In a hand-written reducer, state.items.push(x) changes the old object, so React-Redux sees the same reference and may not re-render. Inside createSlice it is safe only because Immer intercepts the writes. Also keep non-serialisable values such as functions, Dates and class instances out of the store.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Not everything belongs in Redux. Keep form input text, open or closed menus and other purely local state in useState. Reserve the store for data that many distant components share, or whose history you want to debug.',
        },
        {
          type: 'summary',
          points: [
            'Redux keeps shared state in one store and changes it only by dispatching actions processed by pure reducers.',
            'createSlice generates reducers and action creators, and Immer lets you write mutating-looking updates safely inside it.',
            'configureStore combines slices; Provider exposes the store; useSelector reads, useDispatch writes.',
            'Select the smallest value you need, since components re-render when their selected value changes.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A button runs dispatch(added(7)) for a cart slice. In which order do these happen?',
        options: [
          'Reducer runs first, then the action is created, then subscribers are told to re-render',
          'Action is created, reducer returns new state, selecting components re-render',
          'Subscribers re-render, reducer runs, action is created',
          'Action is created, components re-render, reducer runs',
        ],
        answer: 1,
        why: 'The action creator builds the action, dispatch sends it to the store, the reducer returns new state, and then subscribers whose selected data changed re-render.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Inside createSlice, a reducer contains state.items.push(action.payload). Why is this allowed?',
        options: ['Because Redux ignores mutations made inside a reducer and copies the state afterwards', 'Because the array is frozen', 'Because Immer turns the writes into an immutable update', 'Because push returns a new array'],
        answer: 2,
        why: 'Redux Toolkit wraps case reducers with Immer, which tracks changes to a draft and produces a new immutable state. Outside Immer, push would mutate the old state.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const user = useSelector((s) => s.auth.user); and the store updates only s.cart.items. Does this component re-render?',
        options: ['No, because the selected value s.auth.user is unchanged', 'Yes, since every store update re-renders every component subscribed through useSelector', 'Yes, because Provider re-renders', 'Only if useDispatch is also called'],
        answer: 0,
        why: 'useSelector compares the new selected value with the previous one using ===. A cart-only update leaves s.auth.user identical, so no re-render.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these belong inside a Redux reducer?',
        options: [
          'Computing the next state from the current state and the action',
          'Fetching data from an API with fetch',
          'Calling Math.random() to create an id',
          'Returning the existing state for an unknown action',
        ],
        answers: [0, 3],
        why: 'Reducers must be pure and deterministic: same inputs, same output. Network calls and random values are side effects and belong in thunks or the action creator.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In Redux, a component can change the store by assigning to a property of the object returned by useSelector, for example user.name = "Asha".',
        answer: false,
        why: 'State changes only through dispatched actions and reducers. Mutating a selected object bypasses the store, breaks change detection and DevTools history.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The function created by createSlice that you call as added(42) to build an action is called an action ____.',
        answer: 'creator',
        accept: ['creators'],
        why: 'createSlice generates action creators, functions that return action objects such as { type: "cart/added", payload: 42 }.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put the steps of Redux Toolkit setup in a sensible order.',
        items: [
          'Create a slice with createSlice',
          'Pass the slice reducer to configureStore',
          'Wrap the app in Provider with the store',
          'Read state with useSelector in a component',
          'Send updates with useDispatch',
        ],
        why: 'You need slices before the store, the store before Provider, and Provider before components can call the hooks.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a createSlice call named "counter" with initialState { value: 0 } and a reducer called incremented that adds 1 to state.value.',
        language: 'tsx',
        starter: 'const counterSlice = createSlice({\n  name: \'counter\',\n});',
        solution: 'const counterSlice = createSlice({\n  name: \'counter\',\n  initialState: { value: 0 },\n  reducers: {\n    incremented(state) {\n      state.value += 1;\n    },\n  },\n});',
        checks: [
          { label: 'Sets initialState with value 0', pattern: String.raw`initialState\s*:\s*\{\s*value\s*:\s*0` },
          { label: 'Defines an incremented reducer', pattern: String.raw`incremented\s*(\(|:)` },
          { label: 'Increases state.value', pattern: String.raw`state\.value\s*(\+=\s*1|=\s*state\.value\s*\+\s*1|\+\+)` },
        ],
        why: 'createSlice needs a name, initialState and a reducers object. Immer allows writing state.value += 1 directly inside a case reducer.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A hand-written reducer (not createSlice) does: state.items.push(action.payload); return state; After dispatching, the cart badge does not update. What is the most likely cause?',
        options: ['The reducer must return a promise', 'Provider is missing a key', 'The action needs a longer type string, because short types are ignored by the reducer', 'The reducer mutated state and returned the same reference'],
        answer: 3,
        why: 'Returning the same object reference tells React-Redux nothing changed. Plain reducers must return a new object, such as { ...state, items: [...state.items, action.payload] }.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'const items = useSelector((s) => s.cart.items.filter((i) => i.qty > 0)); The component re-renders on every store update, even unrelated ones. Why?',
        options: ['useSelector always re-renders the component on every dispatch, whatever the selector returns', 'filter returns a new array each time, so the selected value is never ===', 'qty is a number', 'The store is not frozen'],
        answer: 1,
        why: 'useSelector compares the result with ===. A fresh array each call looks changed. Select the raw array and filter outside, or use a memoised selector.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A team needs to load a product list from an API and store it. Where should the fetch call happen?',
        options: ['In a createAsyncThunk (or RTK Query), with reducers handling its pending, fulfilled and rejected actions', 'Inside the reducer itself, so the returned state already contains the response when it is stored', 'Inside configureStore', 'In the Provider component'],
        answer: 0,
        why: 'Reducers must be pure, so side effects live in thunks. createAsyncThunk dispatches lifecycle actions that slices handle to store data, loading and errors.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which data is the weakest candidate for the Redux store?',
        options: ['The logged-in user used by 30 components', 'A shopping cart read by the header and checkout', 'The text currently typed into one search box on one page', 'App-wide notification messages'],
        answer: 2,
        why: 'Text used by a single component is local UI state; useState keeps it simple. Redux fits data shared widely or worth tracing.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'configureStore({ reducer: { cart: cartSlice.reducer, user: userSlice.reducer } }) creates a state tree. What does store.getState() look like at the start?',
        options: ['An array of two slices, one entry per reducer in the order they were declared in the object', 'An object with cart and user keys holding each slice’s initial state', 'Only the cart slice', 'undefined until the first action'],
        answer: 1,
        why: 'The keys of the reducer object become keys of the root state, each managed by its slice reducer and starting from its initialState.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are real benefits of Redux’s one-way data flow?',
        options: [
          'Every change comes from a described action, which helps debugging',
          'DevTools can replay actions and show state history',
          'Components can mutate the store directly for speed',
          'Reducers are pure, so they are easy to unit-test',
        ],
        answers: [0, 1, 3],
        why: 'Actions give a log of what happened, and pure reducers are deterministic. Direct mutation is exactly what Redux forbids.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which statements about useSelector are true?',
        options: [
          'It reads a part of the store’s state',
          'It re-renders the component when the selected value changes by ===',
          'It dispatches actions',
          'It must be called inside a component wrapped by Provider',
        ],
        answers: [0, 1, 3],
        why: 'useSelector reads state and subscribes to changes, and it needs the store from Provider. Dispatching is the job of useDispatch.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'An action in Redux is a function that changes the state.',
        answer: false,
        why: 'An action is a plain object that describes what happened. The reducer is the function that computes the new state.',
        difficulty: 1,
      },
      {
        type: 'truefalse',
        q: 'Two slices created with createSlice can each hold their own part of the state and be combined in one call to configureStore.',
        answer: true,
        why: 'configureStore’s reducer option accepts an object of slice reducers; each key becomes a branch of the root state.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'Redux Toolkit’s createSlice lets you write mutating-looking updates safely because it uses the library ____ internally.',
        answer: 'Immer',
        accept: ['immer.js', 'immerjs'],
        why: 'Immer records changes to a draft copy and produces an immutable result, so you avoid manual spread-copy code.',
        difficulty: 2,
      },
      {
        type: 'match',
        q: 'Match each Redux term to its role.',
        pairs: [
          ['dispatch', 'Sends an action to the store'],
          ['reducer', 'Pure function from state and action to new state'],
          ['selector', 'Reads a value from the state tree'],
          ['Provider', 'Makes the store available to components'],
        ],
        why: 'Each piece has a single job in the one-way flow: components dispatch, reducers compute, selectors read and Provider supplies the store.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a component that reads state.cart.items.length with useSelector into count, gets dispatch from useDispatch, and renders a button that dispatches cleared() when clicked. Assume cleared is imported.',
        language: 'tsx',
        starter: 'function ClearButton() {\n  return <button>Clear</button>;\n}',
        solution: 'function ClearButton() {\n  const count = useSelector((s: RootState) => s.cart.items.length);\n  const dispatch = useDispatch();\n  return <button onClick={() => dispatch(cleared())}>Clear ({count})</button>;\n}',
        checks: [
          { label: 'Reads with useSelector', pattern: String.raw`useSelector\s*\(` },
          { label: 'Gets dispatch', pattern: String.raw`useDispatch\s*\(\s*\)` },
          { label: 'Dispatches cleared() on click', pattern: String.raw`onClick\s*=\s*\{[^}]*dispatch\s*\(\s*cleared\s*\(\s*\)\s*\)` },
        ],
        why: 'useSelector picks the data, useDispatch returns dispatch, and the click handler dispatches the action object that cleared() creates.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-20': {
    summary: 'Zustand gives you a shared store as a plain hook created with create(), with no providers, reducers or action types to write.',
    lesson: {
      minutes: 8,
      objectives: [
        'Create a Zustand store with create() containing state and action functions that call set.',
        'Read only the needed slice of state with a selector so components re-render less.',
        'Compare Zustand with Redux Toolkit and Context and choose between them for a scenario.',
        'Separate client state (UI, preferences) from server state (fetched data) and name a tool for each.',
      ],
      simple: 'Zustand is a small library that lets you make a shared store by writing one function. The store is also a hook, so any component can call it and read or change the data. There is no setup wrapper and no action boilerplate, which makes it a popular lighter alternative to Redux.',
      blocks: [
        {
          type: 'text',
          title: 'Redux power without the ceremony',
          body: 'The previous topic, Redux Architecture, showed a very disciplined way to share state: slices, actions, reducers, a store and a Provider. That discipline is valuable in huge teams, but for a medium app it can feel heavy. Zustand (German for “state”) keeps the useful idea, one central store that many components can share, and removes the ceremony. You call create() with a function that returns your state and the functions that change it. The result is a hook. You call that hook in any component, anywhere, without wrapping the app in a Provider.',
        },
        {
          type: 'analogy',
          body: 'Redux is like a government office: forms, counters, stamps, and a clear paper trail for every change. Zustand is like a shared whiteboard in an office kitchen with a marker hanging beside it: anyone can read it, and anyone can write on it by following a simple convention. It is quicker for small teams, but with a larger crowd you may want stronger rules.',
        },
        {
          type: 'text',
          title: 'Creating and using a store',
          body: 'The function you pass to create() receives set and get. Call set with an object of changes, and Zustand merges it into the current state at the top level, much like setState in old class components. You do not spread the old state yourself for top-level keys. For nested values you still create new objects, because Zustand, like React, relies on references changing. Call get() when an action needs to read the current state. The store lives outside React, so it is the same for every component. In a component you call the hook with a *selector*, a function that picks the part you need, for example useCartStore(s => s.items.length). The component re-renders only when the selected value changes.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'The store holds items plus three actions. Note that actions live right next to the data and use set; set(s => ...) is the functional form, like setState(prev => ...). Each component selects only what it needs, so CartBadge re-renders when the item count changes, but AddButton, which selects only the add function, never re-renders because of cart changes. No Provider is required.',
          code: `import { create } from 'zustand';

type CartState = {
  items: string[];
  add: (name: string) => void;
  clear: () => void;
  total: () => number;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  add: (name) => set((s) => ({ items: [...s.items, name] })),
  clear: () => set({ items: [] }),
  total: () => get().items.length,
}));

function CartBadge() {
  const count = useCartStore((s) => s.items.length);
  return <span>Cart ({count})</span>;
}

function AddButton() {
  const add = useCartStore((s) => s.add);
  return <button onClick={() => add('Masala chai')}>Add</button>;
}`,
        },
        {
          type: 'text',
          title: 'Selectors, shallow comparison and middleware',
          body: 'Zustand compares the selected value with ===. Selecting a primitive such as s.items.length is safe. If your selector builds a new object or array each time, such as s => ({ a: s.a, b: s.b }), the result is “new” on every store change, so the component re-renders every time (and in Zustand v5 can loop). Wrap such a selector in useShallow, which compares the contents one level deep, or call the hook once per value. Zustand also has optional middleware: devtools connects the store to the Redux DevTools extension, and persist saves the state to localStorage so a refresh keeps the cart.',
        },
        {
          type: 'example',
          title: 'Worked example: choosing the tool',
          body: 'A team builds three features. Feature A: a dark-mode toggle read by 5 components and changed rarely. Context is enough: it re-renders all consumers on a change, but a rare toggle makes that harmless. Feature B: a shopping cart read by the header, the product grid and the checkout, changed often. Zustand fits: any component selects exactly the slice it needs, and no Provider is needed. Feature C: a banking-style ledger where 12 developers must audit every state change in DevTools and follow strict conventions. Redux Toolkit fits best because its action log and enforced pure reducers make changes traceable. Finally, the list of products fetched from the server is not client state at all; a server-state library such as TanStack Query or RTK Query handles caching, refetching and loading flags better than any store.',
        },
        {
          type: 'compare',
          title: 'Redux Toolkit vs Zustand',
          columns: ['Redux Toolkit', 'Zustand'],
          rows: [
            ['Setup', 'Slices, configureStore, Provider', 'One create() call, no Provider'],
            ['Changing state', 'Dispatch an action to a reducer', 'Call an action function that uses set'],
            ['Structure', 'Strict, one-way and traceable', 'Flexible, you choose the conventions'],
            ['Debugging', 'Redux DevTools by default', 'Redux DevTools via devtools middleware'],
            ['Best for', 'Large teams, complex shared state', 'Small to medium apps, quick shared state'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'create()', def: 'The Zustand function that builds a store and returns it as a React hook.' },
            { term: 'set', def: 'The function that merges new values into the store’s state, in object or function form.' },
            { term: 'Selector', def: 'A function passed to the hook so a component subscribes only to the part of state it uses.' },
            { term: 'useShallow', def: 'A helper that compares a selector’s object or array result one level deep to avoid needless re-renders.' },
            { term: 'Server state', def: 'Data owned by a server and cached on the client, best managed by tools such as TanStack Query.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Do not call useCartStore() with no selector in a component that needs only one field. It subscribes to the entire state, so the component re-renders on every change in the store, the very problem state libraries are supposed to avoid.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body: 'Zustand’s store works outside React too: useCartStore.getState() reads the state and useCartStore.setState() updates it, which is handy in utility code or tests.',
        },
        {
          type: 'summary',
          points: [
            'create() returns a hook; the store holds state and its actions together, with no Provider.',
            'set merges top-level changes; nested objects and arrays still need new references.',
            'Always pass a selector, and use useShallow when a selector builds a new object or array.',
            'Pick Context for rarely changing values, Zustand for lightweight shared state, Redux Toolkit for strict large-scale control, and a server-state library for fetched data.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'const useStore = create((set) => ({ n: 0, inc: () => set((s) => ({ n: s.n + 1 })) })); A component calls inc() twice in a row from n = 0. What is n afterwards?',
        options: ['undefined', '1', '0', '2'],
        answer: 3,
        why: 'The functional form of set receives the latest state each time, so the first call makes n 1 and the second makes it 2.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A Navbar uses const state = useCartStore() and shows only state.items.length. Items are added 10 times while the user types in an unrelated profile field stored in the same store. How often does Navbar re-render because of the typing?',
        options: ['Never, because it only displays items.length and does not read any other field of the state', 'Only when items.length changes', 'Once at the end', 'On every keystroke, because it subscribes to the whole state'],
        answer: 3,
        why: 'Calling the hook without a selector subscribes to the entire state, so any change triggers a render. Use useCartStore(s => s.items.length) instead.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which of these is required to share state with react-redux (Redux Toolkit) but not with a Zustand store?',
        options: ['A hook to read state', 'A Provider wrapping the app', 'JavaScript functions', 'A single source of truth for the whole application state'],
        answer: 1,
        why: 'A Zustand store is a module-level hook, so components can use it without a Provider. React-Redux requires Provider to supply the store.',
        difficulty: 1,
      },
      {
        type: 'multi',
        q: 'Which of these are true of set in a Zustand store?',
        options: [
          'set({ count: 5 }) merges count into the existing state',
          'set((s) => ({ count: s.count + 1 })) reads the latest state',
          'set must be wrapped in a Provider to work',
          'Nested objects still need new references to be seen as changed',
        ],
        answers: [0, 1, 3],
        why: 'set merges top-level keys and has a functional form. It needs no Provider, and nested changes require new references because change detection uses ===.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A list of products fetched from an API is best stored in a Zustand store, because Zustand is designed to cache server responses and refetch them.',
        answer: false,
        why: 'Zustand holds client state. Server state needs caching, refetching and loading flags, which libraries such as TanStack Query or RTK Query provide.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'To keep a Zustand store’s data after a page refresh, you can add the ____ middleware, which saves state to localStorage.',
        answer: 'persist',
        accept: ['persist middleware'],
        why: 'The persist middleware serialises selected state to storage (localStorage by default) and restores it when the store is created.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'const { a, b } = useStore((s) => ({ a: s.a, b: s.b })); The component re-renders on every store update, even when a and b are unchanged. What fixes it?',
        options: ['Use set instead of get', 'Add a Provider around the component, which stops the store from notifying it of every update', 'Wrap the selector in useShallow, or select a and b in separate hook calls', 'Replace create with createSlice'],
        answer: 2,
        why: 'The selector returns a new object on each call, so === sees a change. useShallow compares the properties one level deep, and separate calls return primitives.',
        difficulty: 3,
      },
      {
        type: 'code',
        q: 'Create a Zustand store hook named useCounter with state count: 0 and an increment action that adds 1 using the functional form of set.',
        language: 'tsx',
        starter: 'import { create } from \'zustand\';\n\nexport const useCounter = ',
        solution: 'import { create } from \'zustand\';\n\nexport const useCounter = create<{ count: number; increment: () => void }>((set) => ({\n  count: 0,\n  increment: () => set((s) => ({ count: s.count + 1 })),\n}));',
        checks: [
          { label: 'Calls create', pattern: String.raw`create\s*[<(]` },
          { label: 'Starts count at 0', pattern: String.raw`count\s*:\s*0` },
          { label: 'Increments with set', pattern: String.raw`set\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\(\s*\{\s*count\s*:\s*\w+\.count\s*\+\s*1` },
        ],
        why: 'create takes a function receiving set; the returned object holds both state and actions. set(s => ({ ... })) reads the latest state.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A team of 3 builds a to-do app with a list shared by 4 components and no strict audit needs. Which choice is most proportionate?',
        options: ['A Zustand store', 'A custom event bus', 'A full Redux Toolkit setup with thunks and RTK Query', 'Prop drilling through 6 levels'],
        answer: 0,
        why: 'Zustand gives shared state with minimal code. Redux Toolkit is justified when strictness and traceability matter more; prop drilling is what a store avoids.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'const useStore = create((set) => ({ user: { name: "Asha", age: 30 }, birthday: () => set((s) => { s.user.age += 1; return s; }) })); Components selecting s.user.age never update. Why?',
        options: ['set cannot take a function, so the updater must be an object literal replacing the whole state', 'age must be a string', 'The code mutates the existing object and returns the same state reference', 'Selectors only work on arrays'],
        answer: 2,
        why: 'Zustand detects change by reference. Mutating s.user and returning s keeps every reference the same, so selectors see nothing new. Return user: { ...s.user, age: s.user.age + 1 }.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'const total = useStore.getState().count; is written in a plain utility function outside any component. What does it do?',
        options: ['Reads the current count once, without subscribing to changes', 'Throws, since the hook is called outside React', 'Subscribes the function to updates', 'Resets the store'],
        answer: 0,
        why: 'The store object exposes getState and setState for use outside React. They read and write the state without creating a subscription.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'An app shows a dark-mode flag read by 3 components and toggled about once a day. Which tool is simplest?',
        options: ['Redux Toolkit with a theme slice and DevTools', 'A custom reducer in every component', 'A server-state library', 'React Context (or a tiny store) holding the one flag'],
        answer: 3,
        why: 'Rarely changing values are the sweet spot for Context, where re-rendering all consumers is cheap. Heavier tools add cost without benefit.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Two components call useCartStore((s) => s.items). One calls add("Tea") on a button. What happens to both components?',
        options: ['Only the button’s component re-renders, because it is the one that called add', 'Both re-render with the new items array', 'Neither re-renders', 'Both unmount'],
        answer: 1,
        why: 'Both select the same slice, which gets a new array after add. Stores are shared, so every subscribed component sees the update.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are advantages Zustand has over a hand-written Redux setup?',
        options: [
          'No Provider needed',
          'Actions and state defined together in one function',
          'Mandatory immutable reducers with an action log',
          'Very little boilerplate',
        ],
        answers: [0, 1, 3],
        why: 'Zustand needs no Provider, keeps actions with state and is short to write. Strict reducers with an action log are a Redux feature, not a Zustand default.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which kinds of data are better handled by a server-state library such as TanStack Query than by a Zustand store?',
        options: ['A paginated list of orders fetched from an API', 'Whether a sidebar is collapsed', 'User profile data that should be refetched in the background', 'The text in a search box'],
        answers: [0, 2],
        why: 'Fetched data needs caching, refetching and loading or error states, which server-state tools provide. Sidebar and input state are plain client state.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In Zustand, set({ count: 5 }) replaces the entire store state with { count: 5 }, removing all other fields and actions.',
        answer: false,
        why: 'By default set merges the object into the existing state at the top level, so other fields and actions stay. You pass true as a second argument to replace instead.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'A Zustand store can be read and updated from code that is not a React component, using getState and setState.',
        answer: true,
        why: 'The store lives outside React, so utilities and tests can call useStore.getState() and useStore.setState() directly.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The creator function passed to create receives set first and a second function that returns the latest state when called. That second function is named ____.',
        answer: 'get',
        accept: ['get()'],
        why: 'get returns the latest state at call time, which is useful for actions such as total: () => get().items.length.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these steps in order for adding a new shared “wishlist” feature with Zustand.',
        items: [
          'Call create() with state and actions for the wishlist',
          'Export the resulting hook as useWishlistStore',
          'In a component, call the hook with a selector',
          'Call an action such as add on a button click',
        ],
        why: 'You define the store first, export it, read the needed slice with a selector, then call actions to change it.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a component that selects only the add function from useCartStore (not the whole state) and renders a button labelled Add that calls add("Samosa") when clicked.',
        language: 'tsx',
        starter: 'function AddButton() {\n  return null;\n}',
        solution: 'function AddButton() {\n  const add = useCartStore((s) => s.add);\n  return <button onClick={() => add(\'Samosa\')}>Add</button>;\n}',
        checks: [
          { label: 'Uses a selector for add', pattern: String.raw`useCartStore\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.add\s*\)` },
          { label: 'Calls add with Samosa on click', pattern: String.raw`onClick\s*=\s*\{[^}]*add\s*\(\s*["']Samosa["']\s*\)` },
        ],
        why: 'Selecting only add means the component does not re-render when items change, because the function reference stays the same.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-21': {
    summary: 'React Router maps browser URLs to components so a single-page app can have many pages without reloading.',
    lesson: {
      minutes: 8,
      objectives: [
        'Declare routes with BrowserRouter, Routes and Route, including a catch-all route.',
        'Navigate with Link, NavLink and useNavigate without a full page reload.',
        'Read dynamic URL values with useParams and query strings with useSearchParams.',
        'Build a shared layout with nested routes and Outlet.',
      ],
      simple: 'React Router lets one React app behave like many pages. It watches the address bar, picks the component that matches the path, and swaps it in without asking the server for a new page. Links change the URL and React redraws only what is needed.',
      blocks: [
        {
          type: 'text',
          title: 'One page, many “pages”',
          body: 'A traditional website asks the server for a new HTML document each time you click a link. A single-page application (SPA) loads once and then updates the screen with JavaScript. But users still expect separate addresses: /products, /products/42, /cart, so they can bookmark, share and use the back button. Client-side routing connects the two. React Router (version 6 and later, which this lesson uses) updates the URL with the browser History API and decides which component to show, all without a full reload. This is why navigation feels instant.',
        },
        {
          type: 'analogy',
          body: 'Think of a railway station’s announcement board. The platform number (the URL path) decides which train (component) you see. The station building, with its ticket counter and waiting hall, stays the same all day; only the train at the platform changes. A router is that board, and a layout route is the unchanging station building.',
        },
        {
          type: 'text',
          title: 'Declaring routes',
          body: 'Wrap your app once in BrowserRouter. Inside it, Routes holds a list of Route elements. Each Route has a path and an element, the JSX to render when the path matches. Version 6 chooses the best match itself, so the old exact prop and Switch component are gone. A path with a colon such as /products/:id is a dynamic segment; inside the matched component, useParams() returns { id: "42" } for the URL /products/42. Note that params are always strings. A path of "*" matches anything left over, so it is the place for a “Page not found” screen. Use Link to navigate, which renders an anchor tag but handles clicks without reloading; NavLink is a Link that knows when it is active so you can style the current menu item.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'A small shop with a home page, a product page driven by the :id parameter, and a catch-all. ProductPage reads the param with useParams and moves on with useNavigate, which returns a function; calling navigate("/cart") changes the URL and renders CartPage without reloading.',
          code: `import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';

function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <h1>Product #{id}</h1>
      <button onClick={() => navigate('/cart')}>Buy now</button>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link> | <Link to="/products/42">Chai set</Link>
      </nav>
      <Routes>
        <Route path="/" element={<h1>Welcome</h1>} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/cart" element={<h1>Your cart</h1>} />
        <Route path="*" element={<h1>Page not found</h1>} />
      </Routes>
    </BrowserRouter>
  );
}`,
        },
        {
          type: 'text',
          title: 'Nested routes, layouts and query strings',
          body: 'Routes can be nested. A parent route with an element containing <Outlet /> acts as a layout: the shared header and sidebar stay, while the matching child route is drawn at the Outlet position. A child with the index prop renders when the parent’s own path matches exactly. Child paths are relative to the parent, so path="settings" under "/account" is /account/settings. For query strings like /products?sort=price, use useSearchParams, which works like useState: it returns the current params and a function to update them. Because the filter then lives in the URL, a user can bookmark or share the filtered list.',
        },
        {
          type: 'example',
          title: 'Worked example: matching URLs',
          body: 'Given routes "/", "/products/:id", "/cart" and "*": the URL /products/42 matches the second route, and useParams gives id = "42". The URL /cart matches the third. The URL /products has no match for the second route, because :id needs a value, so it falls to "*" and shows “Page not found”. Now add a layout: <Route path="/account" element={<AccountLayout />}> with children <Route index element={<Profile />} /> and <Route path="settings" element={<Settings />} />. Visiting /account renders AccountLayout with Profile in its Outlet. Visiting /account/settings renders the same layout with Settings in the Outlet, and the layout’s navigation does not remount.',
        },
        {
          type: 'compare',
          title: 'Link vs a plain anchor, and useNavigate vs Navigate',
          columns: ['Client-side (React Router)', 'Plain browser behaviour'],
          rows: [
            ['<Link to="/cart">', 'Changes the URL and swaps components with no reload', '<a href="/cart"> reloads the full page from the server'],
            ['After a form submit', 'navigate("/thanks") in an event handler', 'A server redirect response'],
            ['Redirect while rendering', '<Navigate to="/login" replace /> element', 'A 302 response header'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Route', def: 'A rule that pairs a URL path with the element to display.' },
            { term: 'Dynamic segment', def: 'A part of a path such as :id that matches any value and is read with useParams.' },
            { term: 'Outlet', def: 'A placeholder in a parent route’s element where the matching child route is rendered.' },
            { term: 'Index route', def: 'A child route rendered when the parent path matches exactly, with no further segments.' },
            { term: 'useNavigate', def: 'A hook that returns a function for changing the URL from code, such as after a button click.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Use Link, not a plain <a href>, for internal navigation. A plain anchor makes the browser request a whole new page, throwing away your React state. Also remember that useParams returns strings: id from /products/42 is "42", so convert with Number(id) before doing arithmetic.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Production servers must send index.html for any unknown path (for example /products/42), otherwise refreshing the page gives a 404 from the server, because the route exists only inside your React code.',
        },
        {
          type: 'summary',
          points: [
            'BrowserRouter, Routes and Route map URL paths to elements; v6 picks the best match, so exact and Switch are gone.',
            'Link and NavLink navigate without reloading; useNavigate does it from code, and useParams reads :id style segments as strings.',
            'Nested routes plus Outlet build shared layouts; an index route handles the parent’s own path.',
            'A path of "*" is the catch-all for not-found pages, and useSearchParams keeps filters in the URL.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'Routes: "/", "/products/:id", "/cart", "*". A user opens /products/42. Inside the product component, what does useParams() return?',
        options: ['{ id: "42" } with id as a string', '{ id: 42 } with id as a number', '{ products: "42" } keyed by the path segment before the value', 'An empty object'],
        answer: 0,
        why: 'The :id segment captures the text 42, and URL parameters are always strings. Convert with Number(id) if you need a number.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'With the routes "/", "/cart" and "*", which route is rendered for the URL /wishlist?',
        options: ['"/" because it is first', 'None, so an error is thrown', '"*", the catch-all route for unmatched URLs', '"/cart" as the closest match'],
        answer: 2,
        why: 'The "*" path matches any URL that no other route matched, making it the usual place for a not-found page.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A page uses <a href="/cart">Cart</a> for internal navigation, and clicking it resets a counter held in the app’s useState. Which change keeps the state?',
        options: ['Add target="_self" to the anchor', 'Replace it with <Link to="/cart">Cart</Link>', 'Use window.location.assign("/cart") so the router handles the navigation client-side', 'Wrap the anchor in a div'],
        answer: 1,
        why: 'A plain anchor makes the browser reload the page, resetting React state. Link updates the URL with the History API and renders the new route without reloading.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are true in React Router v6?',
        options: [
          'Route uses the element prop to say what to render',
          'Routes picks the best matching route, so the exact prop is not needed',
          'Switch is the component that wraps Route elements',
          'NavLink can tell whether its link is the current page',
        ],
        answers: [0, 1, 3],
        why: 'v6 uses element and ranked matching inside Routes, and NavLink exposes an active state. Switch was replaced by Routes.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A parent route whose element does not include <Outlet /> will still display its matching child routes.',
        answer: false,
        why: 'The child route’s element is drawn at the Outlet position. Without an Outlet in the parent’s element, the child has nowhere to appear.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The hook that returns a function for changing the URL from inside an event handler, for example after a form submit, is called use____.',
        answer: 'Navigate',
        accept: ['navigate', 'usenavigate'],
        why: 'useNavigate returns a navigate function. It is used for programmatic navigation after events such as form submission.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these events in order when a user clicks <Link to="/cart">.',
        items: [
          'Router intercepts the click and prevents a page reload',
          'The URL in the address bar changes through the History API',
          'Routes finds the best matching Route for "/cart"',
          'The matching element renders in place of the old one',
        ],
        why: 'Link first stops the default reload, updates the URL, then the router matches the new path and renders its element.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write a Route for the path /orders/:orderId that renders <OrderPage />. Put it inside Routes.',
        language: 'tsx',
        starter: '<Routes>\n  <Route path="/" element={<Home />} />\n</Routes>',
        solution: '<Routes>\n  <Route path="/" element={<Home />} />\n  <Route path="/orders/:orderId" element={<OrderPage />} />\n</Routes>',
        checks: [
          { label: 'Has the dynamic path', pattern: String.raw`path\s*=\s*["']/?orders/:orderId["']` },
          { label: 'Renders OrderPage via element', pattern: String.raw`element\s*=\s*\{\s*<OrderPage\s*/>\s*\}` },
        ],
        why: 'A Route needs a path with a :param segment and an element prop holding the JSX to render.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'Routes: <Route path="/account" element={<Layout />}> with children <Route index element={<Profile />} /> and <Route path="settings" element={<Settings />} />. Which component shows inside Layout’s Outlet at /account?',
        options: ['Settings', 'Layout again, because the index route renders its parent a second time', 'Nothing', 'Profile, through the index route'],
        answer: 3,
        why: 'An index route renders when the parent’s own path matches exactly, so /account shows Profile and /account/settings shows Settings.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A product page reads const { id } = useParams(); and calculates id + 1 for the next product, but /products/9 shows 91. What is wrong?',
        options: ['useParams is async', 'id must be destructured twice, once per route level, before it can be used in arithmetic', 'The route needs exact', 'id is the string "9", so + joins text; use Number(id) + 1'],
        answer: 3,
        why: 'Route params are strings, so "9" + 1 gives "91". Converting with Number(id) gives 10.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A user bookmarks /products?sort=price&page=2. Which hook reads the sort value inside the component?',
        options: ['useParams', 'useSearchParams', 'useLocation().pathname only', 'useOutlet'],
        answer: 1,
        why: 'Query strings are read with useSearchParams, for example searchParams.get("sort"). useParams reads path segments such as :id.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'After refreshing the browser at /products/42 on a freshly deployed SPA, the server shows a 404 page. What is the usual fix?',
        options: ['Replace BrowserRouter with Routes, since BrowserRouter cannot handle nested paths on refresh', 'Use Link instead of NavLink', 'Configure the server to return index.html for unknown paths', 'Add path="*" to the server'],
        answer: 2,
        why: 'The route exists only in the client code. The server must serve the app’s index.html for any path so React Router can then handle it.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which element sends a user who is not logged in to /login while a component renders, replacing the history entry?',
        options: ['<Navigate to="/login" replace />', '<Link to="/login" replace /> placed inside the component output', '<Outlet context="/login" />', '<Route path="/login" />'],
        answer: 0,
        why: 'Navigate redirects when rendered; the replace prop swaps the current history entry so Back does not return to the protected page.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which paths match the route path="/products/:id"?',
        options: ['/products/7', '/products/abc', '/products', '/products/7/reviews'],
        answers: [0, 1],
        why: ':id matches any single segment, number or text. /products lacks the segment and /products/7/reviews has an extra segment.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which are valid reasons to use nested routes with an Outlet?',
        options: [
          'A shared sidebar should persist while inner pages change',
          'Child paths can be written relative to the parent',
          'It forces the server to render each page',
          'The layout does not remount when you move between its children',
        ],
        answers: [0, 1, 3],
        why: 'Nested routes keep layouts mounted, allow relative child paths and fill the Outlet. They do not involve server rendering.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In React Router v6, you must add the exact prop to <Route path="/"> to stop it matching every URL.',
        answer: false,
        why: 'v6 ranks routes and matches whole paths by default, so exact was removed.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'NavLink renders a link that can receive an active style when its destination matches the current URL.',
        answer: true,
        why: 'NavLink exposes an isActive state through its className or style function, which is useful for highlighting the current menu item.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'In a layout route, the placeholder where child routes render is the <____ /> component.',
        answer: 'Outlet',
        accept: ['outlet'],
        why: 'Outlet marks the position in the parent’s element where the matched child route’s element is displayed.',
        difficulty: 1,
      },
      {
        type: 'match',
        q: 'Match each React Router item to its job.',
        pairs: [
          ['useParams', 'Reads :id style values from the path'],
          ['useSearchParams', 'Reads and updates the ?key=value query string'],
          ['useNavigate', 'Changes the URL from code'],
          ['Link', 'Navigates from a click without a reload'],
        ],
        why: 'Each tool addresses a different part of navigation: path values, query values, programmatic moves and click-based moves.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a button component GoHome that uses useNavigate and navigates to "/" when clicked.',
        language: 'tsx',
        starter: 'function GoHome() {\n  return <button>Home</button>;\n}',
        solution: 'function GoHome() {\n  const navigate = useNavigate();\n  return <button onClick={() => navigate(\'/\')}>Home</button>;\n}',
        checks: [
          { label: 'Calls useNavigate', pattern: String.raw`useNavigate\s*\(\s*\)` },
          { label: 'Navigates to the root on click', pattern: String.raw`onClick\s*=\s*\{[^}]*navigate\s*\(\s*["']/["']\s*\)` },
        ],
        why: 'useNavigate returns a function; calling it inside the click handler changes the URL without reloading.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-22': {
    summary: 'React.lazy and Suspense split your app into smaller JavaScript files that load only when needed, showing a fallback in the meantime.',
    lesson: {
      minutes: 8,
      objectives: [
        'Explain why shipping one large JavaScript bundle slows the first page load.',
        'Write a lazy component with React.lazy and dynamic import(), and wrap it in Suspense with a fallback.',
        'Apply code splitting at route level with React Router.',
        'Handle load failures with an error boundary and avoid common mistakes such as a missing default export.',
      ],
      simple: 'Code splitting means not sending the whole app to the browser at once. React.lazy loads a component’s code only when it is first needed, and Suspense shows a temporary placeholder, such as a spinner, while that code arrives.',
      blocks: [
        {
          type: 'text',
          title: 'Why the first load feels slow',
          body: 'When you build a React app, a bundler such as Vite or webpack joins all your code into JavaScript files called bundles. If everything is in a single bundle, a visitor on a slow mobile network must download, parse and run the code for the admin dashboard, the charts library and the settings page, even if they only wanted to see the home page. A 1.5 MB bundle can take many seconds on a weak 4G connection. Code splitting fixes this by cutting the app into smaller chunks that the browser downloads on demand. The home page loads quickly, and the heavy pages arrive only when the user visits them.',
        },
        {
          type: 'analogy',
          body: 'Imagine ordering a thali at a restaurant. A bad kitchen brings every dish in the menu to your table at once, so you wait for the whole banquet. A good kitchen brings the roti and dal first and the dessert only when you ask for it. React.lazy is the kitchen that serves on demand, and Suspense is the waiter who says “one minute, sir” (the fallback) while the dessert is being prepared.',
        },
        {
          type: 'text',
          title: 'React.lazy and dynamic import',
          body: 'JavaScript has a feature called dynamic import: import("./Chart") looks like a function call and returns a promise (an object representing a result that will arrive later). Bundlers see this call and automatically put Chart and its dependencies in a separate chunk. React.lazy wraps it: const Chart = lazy(() => import("./Chart")). The function passed to lazy runs the first time Chart is rendered, not when the file loads. There is one rule: the imported module must have a default export, because lazy expects the component as the default. For a named export you can write import("./Chart").then(m => ({ default: m.Chart })).',
        },
        {
          type: 'text',
          title: 'Suspense: waiting gracefully',
          body: 'While a lazy component is still downloading, React cannot render it. It needs somewhere to look for what to show instead. That is Suspense. Wrap lazy components in <Suspense fallback={<Spinner />}>. React renders the fallback until the chunk arrives, then swaps in the real component. A Suspense boundary can wrap several lazy components, and boundaries can be nested: a small boundary around a chart shows a local spinner, while the rest of the page stays visible. If the download fails, for example because the network drops, the lazy component throws an error, and you should catch it with an error boundary placed outside Suspense so you can show “Could not load, try again” rather than a blank screen.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'Route-level code splitting. Each page becomes its own chunk, downloaded only when the user first visits its route (the Reports chunk, which may include a heavy charts library, never loads for a visitor who stays on the home page). One Suspense boundary around Routes covers all lazy pages.',
          code: `import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Reports = lazy(() => import('./pages/Reports'));

export function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link> <Link to="/reports">Reports</Link>
      </nav>
      <Suspense fallback={<p>Loading page…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}`,
        },
        {
          type: 'example',
          title: 'Worked example: measuring the gain',
          body: 'A school-fees app ships one bundle of 900 KB. On a 1 Mbps connection (roughly 125 KB per second), that is about 7 seconds before anything interactive appears. The team finds that the Reports page and its chart library account for 500 KB. They convert Reports to a lazy route. The first bundle drops to 400 KB, which downloads in about 3.2 seconds, so the home page becomes usable more than 3 seconds sooner. Users who open Reports wait about 4 more seconds the first time (500 KB at 125 KB per second), but only if they visit it, and the fallback tells them something is happening. In the browser’s Network tab the team sees a new file such as Reports-3fa9c1.js loading only when they click the link, which confirms the split worked.',
        },
        {
          type: 'steps',
          title: 'Splitting a page in four steps',
          steps: [
            'Make sure the page component is the default export of its file.',
            'Replace the static import with const Page = lazy(() => import("./Page")).',
            'Wrap the place where Page renders in <Suspense fallback={...}>.',
            'Wrap the area in an error boundary, then verify in the Network tab that a separate chunk loads on demand.',
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Code splitting', def: 'Dividing an app’s JavaScript into several chunks that are loaded when needed.' },
            { term: 'Dynamic import', def: 'The import("./file") expression, which returns a promise for the module and creates a separate chunk.' },
            { term: 'React.lazy', def: 'A function that turns a dynamic import into a component that loads on first render.' },
            { term: 'Suspense', def: 'A React component that shows a fallback while something inside it is not ready to render.' },
            { term: 'Fallback', def: 'The placeholder UI that a Suspense boundary shows while waiting.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Never call lazy() inside a component body. That creates a brand-new component type on every render, so React throws away the old one and the loaded state, causing flicker and repeated loading. Declare lazy components at the top level of the module, outside any component.',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Split at route boundaries first; they give the biggest, safest wins. Also split rarely used heavy features such as a rich-text editor or a modal with a chart library. Splitting tiny components costs extra network requests and rarely helps.',
        },
        {
          type: 'summary',
          points: [
            'Code splitting makes the first download smaller by loading page or feature code only when it is needed.',
            'lazy(() => import("./X")) needs a default export, and it must be declared at module top level.',
            'A lazy component must be rendered inside a Suspense boundary that provides a fallback.',
            'Add an error boundary for failed chunk downloads, and split at routes before splitting small components.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'const Chart = lazy(() => import("./Chart")); <Chart /> is rendered with no Suspense ancestor. What happens when React first tries to render it?',
        options: ['It renders blank text silently, because React treats a missing fallback as an empty string', 'The chunk loads synchronously', 'React reports an error because there is no Suspense boundary to show a fallback', 'The component loads with a default spinner'],
        answer: 2,
        why: 'A lazy component that is not ready suspends and needs a Suspense boundary above it. Without one React throws an error.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A file exports export function Settings() {...} (a named export). Which code lazily loads it correctly?',
        options: ['lazy(() => import("./Settings").then((m) => ({ default: m.Settings })))', 'lazy(() => import("./Settings"))', 'lazy(Settings)', 'lazy(() => require("./Settings")) which loads the named export through CommonJS'],
        answer: 0,
        why: 'lazy expects the promise to resolve to an object with a default property. The then wrapper maps the named export to default.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A home page loads a 900 KB bundle. A chart library of 400 KB is used only on /reports. Which change cuts the home page download most?',
        options: ['Minify the HTML', 'Add more state', 'Wrap the whole app in React.memo to defer loading', 'Lazy-load the Reports route'],
        answer: 3,
        why: 'Turning the Reports route into a lazy chunk removes its 400 KB from the first bundle, leaving about 500 KB for the home page.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are required for a working lazy-loaded component?',
        options: [
          'A dynamic import() passed to lazy',
          'A Suspense boundary above the lazy component',
          'The lazy component declared inside the parent’s render function',
          'A default export in the imported module (or a mapped one)',
        ],
        answers: [0, 1, 3],
        why: 'lazy needs an import() returning a module with a default export, and Suspense to show the fallback. Declaring lazy inside render would recreate it on every render, so it must be module-level.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'React.lazy downloads the component’s code when the page first loads, so the first render is never delayed.',
        answer: false,
        why: 'lazy runs the import the first time the component is rendered, not at page load. That is how it keeps the initial bundle small, and it is why a fallback is needed.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The prop on Suspense that holds the placeholder UI shown during loading is called ____.',
        answer: 'fallback',
        accept: ['the fallback prop'],
        why: 'Suspense takes a fallback prop, for instance fallback={<Spinner />}, rendered until its lazy children are ready.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Users on a flaky network sometimes see a blank screen after a lazy chunk fails to download. What should wrap the Suspense area?',
        options: ['A second Suspense', 'An error boundary around the lazy part that shows a retry message', 'React.memo', 'A context provider that stores the chunk status'],
        answer: 1,
        why: 'A failed import makes the lazy component throw. Error boundaries catch rendering errors and can show a helpful message instead of a blank page.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write the line that declares a lazily loaded component named Reports from the file ./pages/Reports using React.lazy and a dynamic import.',
        language: 'tsx',
        starter: 'import { lazy } from \'react\';\n\n',
        solution: 'import { lazy } from \'react\';\n\nconst Reports = lazy(() => import(\'./pages/Reports\'));',
        checks: [
          { label: 'Calls lazy with a function', pattern: String.raw`lazy\s*\(\s*\(\s*\)\s*=>` },
          { label: 'Uses dynamic import of ./pages/Reports', pattern: String.raw`import\s*\(\s*["']\./pages/Reports["']\s*\)` },
        ],
        why: 'lazy takes a function returning a dynamic import(). The path inside import() identifies the chunk that gets split out.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'function App() { const Chart = lazy(() => import("./Chart")); return <Suspense fallback="…"><Chart /></Suspense>; } The chart flickers and reloads whenever App re-renders. What is the cause?',
        options: ['lazy is called inside the component, so every render creates a new component type and Chart remounts', 'Suspense fallback must be a component, because a string fallback is not rendered in React 18', 'The import path is a string', 'Chart needs memo'],
        answer: 0,
        why: 'Each render of App creates a new lazy component, so React treats it as a different type and unmounts the old one. Move the lazy call to module top level.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A Suspense boundary wraps the whole page, including a lazy chart. While the 80 KB chart loads, the entire page is replaced by a spinner. Which change keeps the rest visible?',
        options: ['Remove Suspense altogether', 'Make the chart a default export, since named exports cannot trigger a nested Suspense', 'Wrap only the chart in its own nested Suspense with a local fallback', 'Call lazy twice'],
        answer: 2,
        why: 'React shows the fallback of the nearest Suspense boundary. A smaller boundary around the chart limits the loading state to that area.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which feature is the best candidate to lazy-load in a 600 KB app?',
        options: ['A 2 KB footer', 'A 150 KB rich-text editor shown only in a rarely used “Compose” dialog', 'The app’s main navigation bar, since it is rendered on every route and loads first', 'A button used on every page'],
        answer: 1,
        why: 'Large, rarely needed features give the biggest saving. Splitting small or always-used pieces adds requests with little gain.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A bundle analysis shows 3 lazy route chunks of 120 KB, 90 KB and 200 KB, and a main bundle of 300 KB. How much JavaScript does a visitor download who opens only the home page, which lives in the main bundle?',
        options: ['620 KB', '410 KB', '710 KB', '300 KB'],
        answer: 3,
        why: 'Lazy chunks load only when their routes are visited. The home page needs just the 300 KB main bundle; the 710 KB total is only reached by visiting all pages.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'In the browser’s Network tab, how do you confirm a route is truly code-split?',
        options: ['Check that no files load at all until the user logs in, which means the app is code-split', 'Count the console logs', 'Look for a CSS file', 'See a new JavaScript chunk request appear only when you first open that route'],
        answer: 3,
        why: 'A separate JavaScript file, often with a hash in its name, that is fetched on first navigation proves the code was split and loaded on demand.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these describe Suspense accurately?',
        options: [
          'It renders its fallback while a lazy child is loading',
          'It can be nested so different areas show different placeholders',
          'It downloads the chunks itself',
          'It replaces error boundaries for failed loads',
        ],
        answers: [0, 1],
        why: 'Suspense only decides what to show while waiting. The import() downloads the code, and failures still need an error boundary.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which are good places to apply code splitting?',
        options: ['Individual routes or pages', 'A heavy charting or PDF library used on one screen', 'A button component used on every screen', 'A rarely opened modal containing a large editor'],
        answers: [0, 1, 3],
        why: 'Split large, conditionally used code. Components used everywhere would be needed immediately, so splitting them just adds requests.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A lazy component’s code is downloaded again every time it is rendered after the first time.',
        answer: false,
        why: 'Once the module has been loaded, it is cached by the module system, so later renders reuse it without another download.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'Dynamic import("./Page") returns a promise that resolves to the module.',
        answer: true,
        why: 'import() is asynchronous and returns a promise of the module object, which is what lets bundlers create a separate chunk and React.lazy wait for it.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'Dividing a large JavaScript bundle into smaller pieces that load on demand is called code ____.',
        answer: 'splitting',
        accept: ['split'],
        why: 'Code splitting reduces the initial download so that the app becomes interactive sooner.',
        difficulty: 1,
      },
      {
        type: 'order',
        q: 'Put these events in order when a user first opens a lazy route.',
        items: [
          'React renders the route element and the lazy component suspends',
          'The nearest Suspense boundary shows its fallback',
          'The chunk finishes downloading',
          'React renders the real component in place of the fallback',
        ],
        why: 'The lazy component cannot render until its code arrives, so Suspense shows the fallback in the meantime and then swaps in the loaded component.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Wrap <Settings /> (already a lazy component) in a Suspense boundary whose fallback is the text Loading…, written as a string in the fallback prop.',
        language: 'tsx',
        starter: '<Settings />',
        solution: '<Suspense fallback="Loading…">\n  <Settings />\n</Suspense>',
        checks: [
          { label: 'Uses Suspense with a fallback prop', pattern: String.raw`<Suspense\s+fallback\s*=` },
          { label: 'Contains Settings inside', pattern: String.raw`<Settings\s*/>[\s\S]*</Suspense>` },
        ],
        why: 'The fallback prop accepts any renderable value, including a string or element. The lazy component must be a descendant of Suspense.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-23': {
    summary: 'React Server Components render on the server, can fetch data directly and send finished UI to the browser without shipping their own JavaScript.',
    lesson: {
      minutes: 8,
      objectives: [
        'Explain what a Server Component is and what it removes from the client JavaScript bundle.',
        'Write an async Server Component that fetches data with await, as in a Next.js App Router page.',
        'List what a Server Component cannot use: hooks such as useState, effects, event handlers and browser APIs.',
        'Describe how Suspense lets the server stream slow parts of a page.',
      ],
      simple: 'A Server Component is a React component that runs only on the server. It can read a database or call an API directly, then sends the finished result to the browser. Because its code never goes to the browser, pages load lighter and secrets stay safe.',
      blocks: [
        {
          type: 'text',
          title: 'The problem Server Components solve',
          body: 'In the classic React model, covered in the earlier modules, every component ships its JavaScript to the browser. A product page then often works like this: the browser downloads the bundle, React renders an empty shell, a useEffect starts a fetch, and only after the data returns does the user see content. That is a “waterfall” of delays, and the bundle includes libraries (a Markdown parser, a date library) used only to format text that never changes in the browser. React Server Components (RSC), stable in React 19 and used by default in the Next.js App Router, change this: components that only display data can run on the server and send down their output instead of their code.',
        },
        {
          type: 'analogy',
          body: 'Compare a restaurant that sends you home with raw vegetables, masalas and a recipe card, with one that sends a packed tiffin of the cooked meal. Client components are the raw ingredients: you do the cooking on your own stove (the browser). Server Components are the tiffin: the kitchen (server) did the heavy work near its own supplies, and you only open the box. Still, the tiffin can have a small DIY packet, say a chutney to mix, and that part is a client component.',
        },
        {
          type: 'text',
          title: 'How a Server Component works',
          body: 'A Server Component is an ordinary function component that runs once per request (or at build time) on the server. Because it runs there, it can be async: you write async function Page() and use await directly in the body to query a database or call an API, with no useEffect and no loading state. The server turns the rendered result into a compact description of the UI, called the RSC payload, and streams it to the browser. React in the browser merges the payload into the page. The component’s own code, and every library it imports, stays on the server, so it adds zero bytes to the client bundle. Secrets such as database passwords and API keys can safely be used there.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'A Server Component page in the Next.js App Router. Notice what is missing: no useState, no useEffect and no loading flag. The function is async and awaits the data directly. The Suspense boundary lets the server send the page header immediately and stream the slow Reviews section when it is ready. The database function db.product is imaginary but stands for any server-only call.',
          code: `// app/products/[id]/page.tsx  (a Server Component by default)
import { Suspense } from 'react';
import { db } from '@/lib/db';

async function Reviews({ id }: { id: string }) {
  const reviews = await db.reviews.findMany({ where: { productId: id } });
  return (
    <ul>
      {reviews.map((r) => <li key={r.id}>{r.text}</li>)}
    </ul>
  );
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) return <p>Product not found</p>;

  return (
    <main>
      <h1>{product.name}</h1>
      <p>₹{product.price}</p>
      <Suspense fallback={<p>Loading reviews…</p>}>
        <Reviews id={params.id} />
      </Suspense>
    </main>
  );
}`,
        },
        {
          type: 'text',
          title: 'What Server Components cannot do',
          body: 'Because a Server Component renders once on the server and never re-renders in the browser, it has no state and no lifecycle. It cannot use useState, useReducer, useEffect or other hooks that depend on state or on the browser. It cannot attach event handlers such as onClick, because there is no live component in the browser to call them. It cannot use browser-only APIs such as window, localStorage or document. Anything interactive therefore needs a Client Component, covered in the next topic, Client vs Server Components. The two kinds work together: a server page renders the data and hands pieces to small client components for interactivity.',
        },
        {
          type: 'example',
          title: 'Worked example: before and after',
          body: 'Old approach: a ProductPage client component imports a 70 KB Markdown library to render a description, fetches /api/product/42 inside useEffect, and shows “Loading…” until the response arrives. The browser downloads the bundle (including the 70 KB), renders, requests the data, and renders again: two network round trips before content. New approach: ProductPage becomes an async Server Component that does await db.product.findUnique(...) and converts Markdown to JSX on the server. The browser receives finished HTML plus the RSC payload on the first response. The 70 KB library is never sent, and there is one round trip. If Reviews is slow, wrapping it in Suspense lets the title and price appear first while the reviews stream in later.',
        },
        {
          type: 'compare',
          title: 'Server vs client rendering of a component',
          columns: ['Server Component', 'Client Component'],
          rows: [
            ['Where it runs', 'Only on the server', 'In the browser (and pre-rendered on the server)'],
            ['Code sent to browser', 'None', 'Its JavaScript and imports'],
            ['Can use await in the body', 'Yes (async component)', 'No'],
            ['Hooks and onClick', 'Not allowed', 'Allowed'],
            ['Safe for secrets', 'Yes', 'No: everything is visible to the user'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Server Component', def: 'A component that renders only on the server and sends its output, not its code, to the browser.' },
            { term: 'RSC payload', def: 'The compact description of the rendered component tree that the server streams to React in the browser.' },
            { term: 'Async component', def: 'A Server Component declared with async so it can await data in its body.' },
            { term: 'Streaming', def: 'Sending parts of the page as they become ready, using Suspense boundaries to mark where.' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'A common error is using useState or onClick in a Server Component. In the Next.js App Router this gives a build or runtime error telling you to add "use client". The fix is not to sprinkle the directive everywhere, but to move only the interactive piece into a small client component.',
        },
        {
          type: 'callout',
          tone: 'fact',
          body: 'Server Components are not the same as server-side rendering (SSR). SSR renders client components to HTML on the server once and then ships their JavaScript to “hydrate” them. A Server Component’s code is never shipped and never hydrates.',
        },
        {
          type: 'summary',
          points: [
            'Server Components run only on the server, so their code and heavy libraries add nothing to the browser bundle.',
            'They can be async and use await to read data directly, removing the useEffect-then-fetch waterfall.',
            'They cannot use state, effects, event handlers or browser APIs; interactivity needs a Client Component.',
            'Suspense boundaries let the server stream slow sections after the rest of the page is shown.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'A Next.js App Router file app/page.tsx contains export default async function Page() { const rows = await db.users.findMany(); return <Table rows={rows} />; } with no "use client". Where does this component run?',
        options: ['In the browser only', 'On the server only (at request or build time)', 'In both, with state synced', 'Inside a web worker'],
        answer: 1,
        why: 'Components in the App Router are Server Components by default. This one runs on the server, which is why it can await a database call directly.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'A page imports a 90 KB charting library only to format a table into HTML text, and the table never needs interactivity. Moving it into a Server Component changes the client bundle by roughly how much?',
        options: ['It has no effect on bundle size, because the library is bundled for the browser either way', 'It doubles the size', 'It removes the 90 KB, since the library stays on the server', 'It adds a runtime for the library'],
        answer: 2,
        why: 'Server Component code and its imports are never sent to the browser, so the library no longer contributes to the client bundle.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which code has a problem as a Server Component?',
        options: ['function B() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }', 'async function A() { const d = await getData(); return <p>{d.name}</p>; } // reads data on the server before sending', 'function C({ title }) { return <h1>{title}</h1>; }', 'async function D() { return <p>{new Date().getFullYear()}</p>; }'],
        answer: 0,
        why: 'useState and onClick need a live component in the browser. Server Components cannot use state or event handlers, so B must be a Client Component.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these can a Server Component do?',
        options: [
          'Use await to query a database in its body',
          'Call useEffect after the first render',
          'Use an API key stored in a server environment variable',
          'Read window.innerWidth',
        ],
        answers: [0, 2],
        why: 'Server Components may be async and use server-only secrets. Effects and the window object belong to the browser, where Server Components never run.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A Server Component re-renders in the browser each time the user clicks a button on the page.',
        answer: false,
        why: 'Server Components render on the server and send their output; they have no browser-side state or lifecycle, so clicks do not re-render them.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'Streaming a slow section of a server-rendered page later, while the rest appears first, is done by wrapping that section in a ____ boundary.',
        answer: 'Suspense',
        accept: ['suspense'],
        why: 'A Suspense boundary shows its fallback first, and React streams the real content when the awaited data is ready.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'In the old pattern a page runs useEffect(() => { fetch("/api/item").then(setItem) }, []). What is the main benefit of replacing it with an async Server Component using await?',
        options: ['The data request starts only after the browser has rendered', 'The component can use more hooks', 'The data is fetched on the server before the page is sent, removing the extra browser round trip and loading flash', 'The data is stored in localStorage automatically, so later visits never need any network request'],
        answer: 2,
        why: 'The server fetches data close to its source while rendering, so the browser receives ready content without a second request and a loading flash.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write an async Server Component function ProductName that awaits getProduct(id) and returns an h2 containing product.name.',
        language: 'tsx',
        starter: 'export default function ProductName({ id }: { id: string }) {\n  return null;\n}',
        solution: 'export default async function ProductName({ id }: { id: string }) {\n  const product = await getProduct(id);\n  return <h2>{product.name}</h2>;\n}',
        checks: [
          { label: 'Declared async', pattern: String.raw`async\s+function\s+ProductName` },
          { label: 'Awaits getProduct', pattern: String.raw`await\s+getProduct\s*\(` },
          { label: 'Renders product.name in an h2', pattern: String.raw`<h2>\s*\{\s*\w+\.name\s*\}\s*</h2>` },
        ],
        why: 'Server Components can be async functions, so you await the data directly in the body and return JSX.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A Server Component needs to show a user’s order count, which sits in a private database. The team proposes calling the database from a client component so the code is “closer to the user”. What is the best response?',
        options: ['Keep the database call in a Server Component, so credentials and queries never reach the browser at all', 'Do it, since client components are faster and the browser can reach the private database directly', 'Store the password in a React prop', 'Use useEffect on the server'],
        answer: 0,
        why: 'Server code is not exposed to users, so it can hold database credentials. Anything in a client component is downloaded and visible in the browser.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A page takes 2 s to load reviews and 0.1 s to load the product details. With the reviews inside <Suspense fallback={<Skeleton />}>, what does the user see at about 0.3 s?',
        options: ['A blank page until 2 s, because Suspense waits for every request before it shows anything', 'An error', 'Only the skeleton', 'The product details plus a skeleton where reviews will appear'],
        answer: 3,
        why: 'Suspense lets the server stream the ready parts first. The product details are shown while the fallback holds the reviews slot.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'Which statement about Server Components versus server-side rendering (SSR) is correct?',
        options: ['They are the same thing, since both skip hydration and send no component code to the browser', 'SSR still ships component code to hydrate; Server Component code is never sent', 'SSR can only run in the browser', 'Server Components require Redux'],
        answer: 1,
        why: 'SSR produces first HTML for client components that are then hydrated with their JavaScript. Server Components never hydrate and send no code.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A page component is marked async and awaits two independent calls: const a = await getA(); const b = await getB(); Each takes 1 s. How could the wait be shortened to about 1 s?',
        options: ['Start both calls first and await Promise.all([getA(), getB()])', 'Remove await', 'Move both into useEffect', 'Mark the page "use client" so the two calls run in parallel in the browser'],
        answer: 0,
        why: 'Awaiting one after the other adds the times (2 s). Promise.all runs the independent requests in parallel, so the total is about the slower one.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A developer adds window.localStorage.getItem("theme") inside a Server Component. What happens?',
        options: ['It works, as the server provides a window object with a localStorage of its own', 'It returns an empty string quietly', 'It fails, since there is no window or localStorage on the server', 'It runs in the browser instead'],
        answer: 2,
        why: 'Server Components run in a server environment without browser objects, so window is undefined and the code throws.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these are real benefits of Server Components?',
        options: [
          'Smaller JavaScript bundles sent to the browser',
          'Direct access to databases and files during render',
          'Using useState without any restrictions',
          'Keeping API keys out of the browser',
        ],
        answers: [0, 1, 3],
        why: 'Server Components send no component code, can reach server resources and keep secrets private. They cannot use state.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which hooks or features are NOT available in a Server Component?',
        options: ['useState', 'useEffect', 'async/await in the component body', 'onClick handlers'],
        answers: [0, 1, 3],
        why: 'State, effects and event handlers need the browser. async/await in the body is specifically a Server Component feature.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'In the Next.js App Router, a component is a Server Component by default unless the file starts with the "use client" directive.',
        answer: true,
        why: 'App Router components are server-first. Adding "use client" at the top of a file opts that file, and what it imports, into the client bundle.',
        difficulty: 1,
      },
      {
        type: 'truefalse',
        q: 'The component code of a Server Component is downloaded by the browser so it can be hydrated.',
        answer: false,
        why: 'Server Component code stays on the server. Only the rendered output (the RSC payload) and any client components’ code reach the browser.',
        difficulty: 2,
      },
      {
        type: 'fill',
        q: 'The compact description of the rendered server tree that is streamed to the browser is called the RSC ____.',
        answer: 'payload',
        accept: ['rsc payload'],
        why: 'The payload describes the rendered elements and the places where client components go, letting React update the page without receiving server component code.',
        difficulty: 2,
      },
      {
        type: 'order',
        q: 'Put these steps in order for a request to a Server Component page.',
        items: [
          'The browser requests the page URL',
          'The server runs the async component and awaits its data',
          'The server streams the RSC payload and HTML',
          'React in the browser shows the result and hydrates client components',
        ],
        why: 'The server does the data work first and streams the output; the browser then displays it and activates only the interactive client parts.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Wrap a slow async Server Component <Reviews id={id} /> in a Suspense boundary with the fallback <p>Loading reviews…</p>.',
        language: 'tsx',
        starter: '<Reviews id={id} />',
        solution: '<Suspense fallback={<p>Loading reviews…</p>}>\n  <Reviews id={id} />\n</Suspense>',
        checks: [
          { label: 'Uses Suspense with a fallback', pattern: String.raw`<Suspense\s+fallback\s*=\s*\{` },
          { label: 'Reviews is inside the boundary', pattern: String.raw`<Reviews\s+id\s*=\s*\{\s*id\s*\}\s*/>[\s\S]*</Suspense>` },
        ],
        why: 'The nearest Suspense boundary above a suspending component provides the placeholder while the server streams the real content.',
        difficulty: 2,
      },
    ],
  },
  'react-gen-24': {
    summary: 'Client Components, marked with "use client", handle interactivity, while Server Components handle data; the two are composed across a boundary.',
    lesson: {
      minutes: 8,
      objectives: [
        'Decide for a given feature whether it needs a Server Component or a Client Component.',
        'Place the "use client" directive correctly and explain that it marks a boundary for a file and its imports.',
        'Compose Server and Client Components, including passing a Server Component as children to a Client Component.',
        'Identify what props can cross from server to client (serialisable values) and what cannot (functions).',
      ],
      simple: 'In the Next.js App Router every component is a Server Component unless its file begins with "use client". Put the directive on the small pieces that need clicks, state or the browser, and leave everything else on the server. The two kinds fit together like building blocks.',
      blocks: [
        {
          type: 'text',
          title: 'Two kinds of component, one tree',
          body: 'The previous topic, Server Components (RSC), showed that components can run only on the server. But real pages also need interactivity: a Like button that counts, a search box that filters, a menu that opens. Those need state, effects and event handlers, which exist only in the browser. So React has two kinds of component that live in one tree. Server Components do data loading and static layout. Client Components, the ordinary React components from earlier modules, do interaction. In the Next.js App Router every component is a Server Component by default, and you opt a file into the client with the directive "use client" at the very top.',
        },
        {
          type: 'analogy',
          body: 'Think of a wedding hall. The kitchen and the decoration team work behind the scenes (the server) and deliver everything finished. But the DJ console and the dance floor must be right there in the hall (the browser), because they respond to the crowd instantly. You do not move the whole kitchen into the hall just because you need a DJ; you keep each team where it works best.',
        },
        {
          type: 'text',
          title: 'The “use client” boundary',
          body: 'Write "use client" as the first line of a file, above the imports. It does not mean “this one component”; it marks a boundary. That file, and every module it imports, becomes part of the client bundle and can use hooks, onClick and browser APIs. Components outside the boundary stay on the server. You do not need the directive in every client file, only in files that are imported from server code, because once you are inside the boundary everything below it is already client. The rule of thumb: push the boundary as far down the tree as you can, so a single button is a client component, not the whole page.',
        },
        {
          type: 'code',
          language: 'tsx',
          caption: 'LikeButton is a Client Component because it uses useState and onClick. ProductPage is a Server Component that fetches data and renders LikeButton, passing it plain values (a number and a string). Only the small LikeButton file and React’s runtime for it are shipped to the browser.',
          code: `// app/products/[id]/LikeButton.tsx
'use client';
import { useState } from 'react';

export function LikeButton({ initial, productId }: { initial: number; productId: string }) {
  const [likes, setLikes] = useState(initial);
  return (
    <button onClick={() => setLikes(likes + 1)} aria-label={'Like ' + productId}>
      ♥ {likes}
    </button>
  );
}

// app/products/[id]/page.tsx   (Server Component: no directive)
import { db } from '@/lib/db';
import { LikeButton } from './LikeButton';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const p = await db.product.findUnique({ where: { id: params.id } });
  return (
    <main>
      <h1>{p.name}</h1>
      <LikeButton initial={p.likes} productId={params.id} />
    </main>
  );
}`,
        },
        {
          type: 'text',
          title: 'Rules for crossing the boundary',
          body: 'Three rules prevent most errors. First, props passed from a Server Component to a Client Component must be serialisable, meaning they can be turned into data: strings, numbers, booleans, arrays, plain objects, Dates. You cannot pass a function such as an onClick handler defined on the server, because functions cannot be sent over the network. Second, a Client Component cannot import a Server Component, since everything it imports joins the client bundle. But it can receive one as children: a server page can render <Modal><ServerStats /></Modal>, where Modal is a client component, and the server-rendered ServerStats is slotted in. Third, Context providers use createContext and state, so they must be Client Components; place the provider in a small client file and pass server-rendered children through it.',
        },
        {
          type: 'example',
          title: 'Worked example: choosing the type for each piece',
          body: 'A news page has five parts. (1) The article text loaded from a database: Server Component, because it only displays data and needs no interaction. (2) A “Share” button that opens a menu on click: Client Component, because it needs state and onClick. (3) A comment count read from the database: Server Component. (4) A theme toggle that changes dark mode and uses a Context provider: Client Component. (5) A footer with static links: Server Component. Result: only parts 2 and 4 ship JavaScript. Now the common error: a developer puts "use client" at the top of the page file because the Share button needs it. The entire page, including the article text and its heavy Markdown library, then joins the client bundle. The better fix is to move only the Share button into its own client file, leaving the page on the server.',
        },
        {
          type: 'compare',
          title: 'Choosing between them',
          columns: ['Use a Server Component when…', 'Use a Client Component when…'],
          rows: [
            ['Data', 'You fetch from a database or API', 'You need data that changes from user input'],
            ['Interaction', 'None needed', 'onClick, onChange, forms with live state'],
            ['Hooks', 'None are needed', 'useState, useEffect, useContext, custom hooks with state'],
            ['Browser APIs', 'Not needed', 'window, localStorage, geolocation'],
            ['Secrets', 'Use API keys or tokens', 'Never include secrets'],
          ],
        },
        {
          type: 'keyTerms',
          terms: [
            { term: '"use client"', def: 'A directive at the top of a file that marks it, and what it imports, as part of the client bundle.' },
            { term: 'Client Component', def: 'A component that runs in the browser and may use state, effects, event handlers and browser APIs.' },
            { term: 'Serialisable props', def: 'Values that can be turned into data to cross the server-client boundary, such as strings, numbers and plain objects.' },
            { term: 'Client boundary', def: 'The point in the tree where server code hands over to client code because of "use client".' },
          ],
        },
        {
          type: 'callout',
          tone: 'warning',
          body: 'Do not pass a function from a Server Component to a Client Component, as in <Button onClick={() => save()} /> written in a server file. Functions are not serialisable, so React throws an error. Define the handler inside the client component, or use a Server Action marked with "use server".',
        },
        {
          type: 'callout',
          tone: 'tip',
          body: 'Ask “does this need to react to the user?” for each component. If not, leave it on the server. Keep client components small and near the leaves of the tree so most of the page remains server-rendered.',
        },
        {
          type: 'summary',
          points: [
            'In the App Router, components are server components by default; "use client" at the top of a file opts it and its imports into the browser bundle.',
            'Use Client Components for state, effects, event handlers, context and browser APIs; use Server Components for data and static output.',
            'Props crossing from server to client must be serialisable, so functions cannot be passed.',
            'A Client Component cannot import a Server Component, but it can render one passed in as children.',
          ],
        },
      ],
    },
    quiz: [
      {
        type: 'mcq',
        q: 'app/Search.tsx begins with import { useState } from "react"; and uses useState and an onChange handler, with no directive at the top. When imported by a server page, what happens?',
        options: ['It works normally', 'It errors, because hooks need the "use client" directive', 'It runs in the browser automatically, since hooks switch a Server Component to client mode', 'useState is silently ignored'],
        answer: 1,
        why: 'Without "use client", the file is treated as a Server Component, where useState is not allowed. Adding the directive at the top fixes it.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A developer adds "use client" to the top of app/page.tsx because one Share button needs onClick. The page also renders a 70 KB Markdown library to show an article. What is the best improvement?',
        options: ['Leave it; the directive affects only the button and the rest of the page stays on the server', 'Replace the button with a link', 'Add "use client" to every file', 'Move only the Share button into its own "use client" file and keep page.tsx as a Server Component'],
        answer: 3,
        why: 'The directive makes the whole file and its imports part of the client bundle, including the library. Isolating the button keeps the rest on the server.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'A server page renders <Counter onDone={() => console.log("done")} />, where Counter is a Client Component. What is the result?',
        options: ['The function is sent to the browser', 'The prop is converted to a string and the function runs only when Counter calls it', 'It logs on the server', 'An error, because functions are not serialisable props'],
        answer: 3,
        why: 'Props crossing the server-client boundary must be serialisable. Functions are not, so the handler must be defined inside the client component.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which of these need a Client Component?',
        options: [
          'A counter button using useState',
          'A form input with an onChange handler',
          'A footer with five static links',
          'A component reading localStorage',
        ],
        answers: [0, 1, 3],
        why: 'State, event handlers and browser storage need the browser. A static footer can stay a Server Component.',
        difficulty: 1,
      },
      {
        type: 'truefalse',
        q: 'A Client Component can render a Server Component if the server page passes it in as the children prop.',
        answer: true,
        why: 'The server renders the child first and passes the result through; the client component only places it. A client file cannot import a server component directly.',
        difficulty: 3,
      },
      {
        type: 'fill',
        q: 'The directive written at the top of a file to make it part of the browser bundle is called "use ____".',
        answer: 'client',
        accept: ['"use client"', 'use client'],
        why: 'The "use client" directive marks the boundary where server code ends and client code begins.',
        difficulty: 1,
      },
      {
        type: 'mcq',
        q: 'Which props can a Server Component safely pass to a Client Component?',
        options: ['An onClick arrow function', 'A string, a number and a plain object', 'A database connection object', 'A class instance with methods that run on the server'],
        answer: 1,
        why: 'Plain data can be serialised and sent. Functions, connections and class instances cannot cross the boundary.',
        difficulty: 2,
      },
      {
        type: 'code',
        q: 'Write the first lines of a Client Component file: the correct directive, an import of useState from react, and then export a function Toggle that holds a boolean on state starting at false.',
        language: 'tsx',
        starter: 'export function Toggle() {\n  return null;\n}',
        solution: '\'use client\';\nimport { useState } from \'react\';\n\nexport function Toggle() {\n  const [on, setOn] = useState(false);\n  return <button onClick={() => setOn(!on)}>{on ? \'On\' : \'Off\'}</button>;\n}',
        checks: [
          { label: 'Starts with use client', pattern: String.raw`^\s*["']use client["']\s*;?` },
          { label: 'Imports useState', pattern: String.raw`import\s*\{[^}]*useState[^}]*\}\s*from\s*["']react["']` },
          { label: 'Starts state at false', pattern: String.raw`useState\s*(<[^>]*>)?\s*\(\s*false\s*\)` },
        ],
        why: 'The directive must be at the top of the file, before imports. The hook then works because the file is in the client bundle.',
        difficulty: 2,
      },
    ],
    practice: [
      {
        type: 'mcq',
        q: 'A product page needs a heavy chart library for display only, plus a “Add to cart” button that counts clicks. How should the components be split?',
        options: ['Everything as one Client Component', 'The chart as a Client Component and the button as a Server Component, so the click counter stays on the server', 'The chart as a Server Component and the button as a small Client Component', 'Both as Server Components'],
        answer: 2,
        why: 'The chart only displays data, so keeping it on the server avoids shipping the library. Only the button needs state and onClick.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'ThemeProvider uses createContext and useState to track dark mode. The root layout.tsx (a Server Component) wraps the app: <ThemeProvider>{children}</ThemeProvider>. In which kind of file must ThemeProvider be defined?',
        options: ['A file with "use client"', 'A Server Component file', 'Any file; context works on the server', 'A file with "use server"'],
        answer: 0,
        why: 'Context with state needs the browser, so the provider must be a Client Component. The server layout can still pass server-rendered children through it.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'ClientPanel.tsx has "use client" at the top and does import ServerStats from "./ServerStats" where ServerStats is async and awaits the database. What happens?',
        options: ['It works, as ServerStats stays on the server', 'Next.js rewrites the import', 'ServerStats becomes part of the client bundle and its async server code fails', 'The database call runs in the browser safely, using the credentials bundled with the client'],
        answer: 2,
        why: 'Anything imported by a client file joins the client bundle. Pass ServerStats in as children from a server parent instead.',
        difficulty: 3,
      },
      {
        type: 'mcq',
        q: 'Which feature lets a client component trigger server-side code, such as saving a form, without an API route you write yourself?',
        options: ['A Server Action: a function marked with the "use server" directive', 'useEffect running inside a Server Component', 'localStorage', 'React.memo'],
        answer: 0,
        why: 'Server Actions are async functions marked "use server" that run on the server and can be called from client components or forms.',
        difficulty: 2,
      },
      {
        type: 'mcq',
        q: 'A page has 20 components, and 3 need interactivity. Marking the page file "use client" instead of isolating those 3 would most likely...',
        options: ['Reduce the JavaScript sent to the browser, since fewer components are hydrated', 'Remove the need for hooks', 'Make secrets safer', 'Increase the client bundle and lose server-only data fetching'],
        answer: 3,
        why: 'The directive pulls the whole file and its imports into the browser, increasing the bundle and ending direct server access in that tree.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which values can be passed from a Server Component as props to a Client Component?',
        options: ['A string', 'An array of numbers', 'A callback such as () => save()', 'A plain object { id: 4, name: "Tea" }'],
        answers: [0, 1, 3],
        why: 'Data that can be serialised crosses the boundary. A function cannot be sent over the network.',
        difficulty: 2,
      },
      {
        type: 'multi',
        q: 'Which statements about "use client" are correct?',
        options: [
          'It must appear at the top of the file, before imports',
          'It applies to the file and the modules it imports',
          'It must be added to every single component file in the app',
          'It makes the component part of the client JavaScript bundle',
        ],
        answers: [0, 1, 3],
        why: 'The directive defines a boundary, so it goes at the top, covers imports below it and adds that code to the bundle. Files inside a client boundary do not each need it.',
        difficulty: 2,
      },
      {
        type: 'truefalse',
        q: 'A Client Component is rendered only in the browser and never on the server.',
        answer: false,
        why: 'Client Components are usually pre-rendered to HTML on the server and then hydrated in the browser. What defines them is that their code is shipped and can use browser features.',
        difficulty: 3,
      },
      {
        type: 'truefalse',
        q: 'It is good practice to keep client components small and near the leaves of the component tree.',
        answer: true,
        why: 'Small client islands keep most of the page on the server, reducing the JavaScript sent to the browser.',
        difficulty: 1,
      },
      {
        type: 'fill',
        q: 'Values passed across the server-client boundary must be ____, meaning they can be converted into data such as strings and plain objects.',
        answer: 'serialisable',
        accept: ['serializable', 'serialisable props', 'serialisable values'],
        why: 'Only data that can be serialised can travel from the server to the browser, which excludes functions and live connections.',
        difficulty: 2,
      },
      {
        type: 'match',
        q: 'Match each feature to the kind of component that should use it.',
        pairs: [
          ['await db.query()', 'Reads data during server render'],
          ['useState', 'Needs the browser to keep state'],
          ['onClick', 'Needs the browser to handle clicks'],
          ['Private API key', 'Kept safely on the server'],
        ],
        why: 'Server-only resources and secrets belong in Server Components, while state and event handlers need the browser.',
        difficulty: 1,
      },
      {
        type: 'code',
        q: 'Write a server component Layout that renders <Modal> as a client component wrapper and puts the server-rendered <ServerStats /> inside it as children. Use the JSX form.',
        language: 'tsx',
        starter: 'export default function Layout() {\n  return null;\n}',
        solution: 'export default function Layout() {\n  return (\n    <Modal>\n      <ServerStats />\n    </Modal>\n  );\n}',
        checks: [
          { label: 'Renders a Modal element', pattern: String.raw`<Modal\b[^>]*>` },
          { label: 'Places ServerStats inside Modal', pattern: String.raw`<Modal\b[^>]*>[\s\S]*<ServerStats\s*/>[\s\S]*</Modal>` },
        ],
        why: 'Passing a server-rendered element as children lets a Client Component display it without importing it.',
        difficulty: 2,
      },
    ],
  },
};

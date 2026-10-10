const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

const reactContent = {
  1: { t: "The React Philosophy", txt: "React is fundamentally about UI as a pure function of state: UI = f(state). Instead of imperatively mutating the DOM (like jQuery), you declare what the UI should look like for any given state, and React handles the DOM updates." },
  2: { t: "JSX: JavaScript XML", txt: "JSX looks like HTML but is syntactic sugar for React.createElement(). It allows you to embed JavaScript expressions directly into your markup using curly braces {}, combining rendering logic and markup in a single file." },
  3: { t: "The Virtual DOM", txt: "Manipulating the real DOM is incredibly slow. React keeps a lightweight, in-memory representation of the DOM called the Virtual DOM. When state changes, React creates a new Virtual DOM tree and compares it to the old one." },
  4: { t: "The Reconciliation Algorithm", txt: "The process of comparing the old and new Virtual DOM is called Reconciliation. React uses a heuristic O(n) algorithm. It assumes elements of different types produce different trees, and uses the 'key' prop to track child elements across renders." },
  5: { t: "React Fiber Architecture", txt: "Introduced in React 16, Fiber is a complete rewrite of the reconciliation engine. It breaks rendering work into chunks (fibers) that can be paused, aborted, or prioritized. This enables smooth UI rendering without blocking the main thread." },
  6: { t: "Component Mounting", txt: "Mounting is the phase when a component is inserted into the DOM. In modern functional components, this happens when the component function is first executed, and any initial effects (useEffect with an empty dependency array) are fired." },
  7: { t: "Understanding useEffect dependencies", txt: "The dependency array in useEffect tells React when to re-run the effect. If omitted, it runs on every render. If empty [], it runs only on mount. If it contains variables [x, y], the effect runs only when x or y change between renders." },
  8: { t: "Cleanup Functions in useEffect", txt: "If your effect creates a subscription, timer, or event listener, it must return a cleanup function. React runs this cleanup function right before the component unmounts, or before re-running the effect due to changed dependencies, preventing memory leaks." },
  9: { t: "The Rules of Hooks", txt: "Hooks must only be called at the top level of your component. Never call them inside loops, conditions, or nested functions. This rule is necessary because React relies on the call order of hooks to maintain state between renders." },
  10: { t: "Custom Hooks", txt: "A custom hook is simply a JavaScript function whose name starts with 'use' and that calls other hooks. They allow you to extract and reuse stateful logic across multiple components, adhering to the DRY principle without complex component hierarchies." },
  11: { t: "Prop Drilling", txt: "Prop drilling occurs when you pass data through many layers of intermediate components that don't need the data themselves, just to reach a deeply nested child. It makes the intermediate components bloated and tightly coupled." },
  12: { t: "The Context API", txt: "React Context provides a way to pass data through the component tree without having to pass props down manually at every level. It is ideal for global data like themes, user authentication status, or locale preferences." },
  13: { t: "Higher-Order Components (HOCs)", txt: "An HOC is a function that takes a component and returns a new, enhanced component. While popular in class-component eras (e.g., connect() in Redux), they can lead to 'wrapper hell' and have largely been superseded by Hooks." },
  14: { t: "Render Props Pattern", txt: "The render props pattern involves passing a function as a prop to a component. The component calls this function to determine what to render, passing its internal state as an argument. This is another way to share stateful logic." },
  15: { t: "Compound Components", txt: "Compound components are a pattern where two or more components work together to accomplish a useful task (like <select> and <option>). They often use Context implicitly to share state between the parent and child components without explicit prop passing." },
  16: { t: "Controlled vs Uncontrolled Inputs", txt: "A controlled input has its value bound to React state (value={state} onChange={setState}). An uncontrolled input maintains its own internal DOM state, which you access using a ref. Controlled inputs are the React standard for forms." },
  17: { t: "Memoization with React.memo", txt: "By default, when a parent component re-renders, all its children re-render. Wrapping a child in React.memo() tells React to skip rendering the child if its props haven't changed, performing a shallow comparison of the props." },
  18: { t: "useMemo and useCallback", txt: "useMemo caches the result of an expensive calculation between renders. useCallback caches a function definition. They are crucial for maintaining referential equality of props passed to child components wrapped in React.memo." },
  19: { t: "Redux Architecture", txt: "Redux uses a single, global immutable store. State can only be updated by dispatching an 'action' object. Pure functions called 'reducers' take the current state and the action, and return a completely new state object." },
  20: { t: "Zustand & Modern State", txt: "Zustand is a modern, unopinionated state manager that uses hooks. It avoids the boilerplate of Redux (actions, reducers, providers) while still offering centralized state, transient updates, and devtools support." },
  21: { t: "React Router Basics", txt: "React Router allows you to build single-page applications with client-side routing. The URL changes in the browser without requesting a new HTML document from the server, making navigation feel instantaneous." },
  22: { t: "Suspense and Lazy Loading", txt: "React.lazy allows you to dynamically import a component file only when it's needed. You wrap the lazy component in a <Suspense> boundary, providing a 'fallback' UI (like a spinner) while the network request fetches the component code." },
  23: { t: "Server Components (RSC)", txt: "React Server Components run exclusively on the server and never ship their JavaScript to the client. They allow you to fetch data directly from the database during render, drastically reducing bundle size and improving initial load times." },
  24: { t: "Client vs Server Components", txt: "In the modern app router (e.g., Next.js), you must explicitly mark Client Components with 'use client' if they need interactivity (useState, onClick). Server components are the default and are best for static data and security." }
};

let matchCount = 0;

for (let i = 1; i <= 24; i++) {
  const id = 'react-gen-' + i;
  const t = reactContent[i];
  if (!t) continue;
  
  const regex = new RegExp(`topic\\('${id}'[\\s\\S]*?\\\]\\)`);
  
  const replacement = `topic('${id}', '${t.t.replace(/'/g, "\\'")}', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'text', body: '${t.txt.replace(/'/g, "\\'")}' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ])`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    matchCount++;
  }
}

fs.writeFileSync(file, code);
console.log('Fixed ' + matchCount + ' React topics!');

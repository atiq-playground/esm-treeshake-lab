# Frontend Review Checklist

Read this file together with `docs/agents/review/shared-standards.md` when reviewing frontend-owned changes.

### React/Next.js Patterns (HIGH)

When reviewing React/Next.js code, also check:

- **Missing dependency arrays**: `useEffect`/`useMemo`/`useCallback` with incomplete deps
- **State updates in render**: Calling setState during render causes infinite loops
- **Missing keys in lists**: Using array index as key when items can reorder
- **Prop drilling**: Props passed through 3+ levels (use context or composition)
- **Unnecessary re-renders**: Missing memoization for expensive computations
- **Client/server boundary**: Using `useState`/`useEffect` in Server Components
- **Missing loading/error states**: Data fetching without fallback UI
- **Stale closures**: Event handlers capturing stale state values

```tsx
// BAD: Missing dependency, stale closure
useEffect(() => {
  fetchData(userId);
}, []); // userId missing from deps

// GOOD: Complete dependencies
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

```tsx
// BAD: Using index as key with reorderable list
{
  items.map((item, i) => <ListItem key={i} item={item} />);
}

// GOOD: Stable unique key
{
  items.map((item) => <ListItem key={item.id} item={item} />);
}
```
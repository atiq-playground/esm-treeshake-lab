# Architectural Smell Baseline

Read this file together with `docs/agents/review/shared-standards.md` when architectural-smell review is assigned.

Apply this baseline only as a set of labelled heuristics. Architectural smells are judgement calls, never automatic hard violations. Phrase them as `possible <smell>` and provide concrete evidence from the diff and surrounding code.

A documented repository standard always overrides this baseline. Suppress a smell when the repository explicitly endorses the pattern. Skip smells that merely restate something tooling already enforces.

- **Mysterious Name** — A function, variable, type, module, or API whose name does not reveal what it does or holds. Fix by renaming it. If no honest name fits, the design itself is unclear.
- **Duplicated Code** — The same logic shape appears in more than one changed hunk or file. Fix by extracting the shared behavior and calling it from each site.
- **Feature Envy** — A method or module reaches into another object's data or behavior more than its own. Fix by moving the behavior toward the data it depends on.
- **Data Clumps** — The same fields or parameters repeatedly travel together. Fix by introducing a cohesive type or value object.
- **Primitive Obsession** — A primitive or string represents a domain concept with meaningful rules or states. Fix by introducing a small domain type or abstraction.
- **Repeated Switches** — The same switch or conditional cascade over the same type appears in multiple changed locations. Fix by centralizing the mapping or using an appropriate polymorphic design.
- **Shotgun Surgery** — One logical behavior requires scattered changes across many files. Fix by gathering the behavior and its change points into a cohesive module or boundary.
- **Divergent Change** — One file or module is changed for several unrelated reasons. Fix by separating responsibilities so each module has one primary reason to change.
- **Speculative Generality** — Abstractions, parameters, hooks, extension points, or layers are introduced without a concrete use in the changed behavior or documented repository architecture. Fix by deleting or inlining them until a concrete need exists.
- **Message Chains** — Callers navigate long chains such as `a.b().c().d()`, coupling themselves to internal object structure. Fix by hiding the navigation behind a meaningful method at the appropriate boundary.
- **Middle Man** — A class, module, or function mostly delegates without adding policy, translation, ownership, or a useful boundary. Fix by removing it or giving the boundary a real responsibility.
- **Refused Bequest** — A subclass or implementer ignores, disables, or overrides most inherited behavior. Fix by replacing the inheritance relationship with composition or a narrower contract.
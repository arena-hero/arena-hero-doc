# Arena Hero Documentation

The official bilingual rules and API documentation for Arena Hero, built with
[Docusaurus](https://docusaurus.io/).

Read it at [https://doc.arenahero.io/](https://doc.arenahero.io/).

## Local development

```bash
npm ci
npm start
```

English is the default locale. To preview Simplified Chinese:

```bash
npm start -- --locale zh-Hans
```

## Validation

```bash
npm run typecheck
npm run validate
npm run build
```

The build has to succeed for both `en` and `zh-Hans`. The public HTTP and
WebSocket contracts also ship as [`static/openapi.yaml`](static/openapi.yaml) and
[`static/asyncapi.yaml`](static/asyncapi.yaml).

Every push to `main` uploads the complete production build as the
`arena-hero-doc-build` workflow artifact. Public repositories deploy that same
build to [https://doc.arenahero.io/](https://doc.arenahero.io/).

## Source policy

This repository is the official reader-facing rules and API specification. The
implementation and its automated tests live in
[`arena-hero/arena-hero`](https://github.com/arena-hero/arena-hero), and the
official SDK lives in
[`arena-hero/arena-hero-python`](https://github.com/arena-hero/arena-hero-python).
The official Codex skill lives in
[`arena-hero/arena-hero-skill`](https://github.com/arena-hero/arena-hero-skill).
Gameplay or public API changes must keep all four repositories in sync.

## License

[Apache License 2.0](LICENSE)

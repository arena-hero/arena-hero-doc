# Arena Hero Documentation

Official bilingual rules and API documentation for Arena Hero, built with
[Docusaurus](https://docusaurus.io/).

## Local development

```bash
npm ci
npm start
```

The English site is the default locale. To preview Simplified Chinese:

```bash
npm start -- --locale zh-Hans
```

## Validation

```bash
npm run typecheck
npm run validate
npm run build
```

The build must succeed for both `en` and `zh-Hans`. Public HTTP and WebSocket
contracts are also available as [`static/openapi.yaml`](static/openapi.yaml)
and [`static/asyncapi.yaml`](static/asyncapi.yaml).

## Source policy

This repository is the official reader-facing rules and API specification.
The implementation and automated tests live in
[`arena-hero/arena-hero`](https://github.com/arena-hero/arena-hero). Every
gameplay or public API change must update both repositories.

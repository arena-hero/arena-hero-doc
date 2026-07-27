import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Translate, {translate} from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';
import styles from './index.module.css';

function Hero(): ReactNode {
  const coreImage = useBaseUrl('img/units/core.png');
  const workerImage = useBaseUrl('img/units/worker.png');
  const vanguardImage = useBaseUrl('img/units/vanguard.png');
  const rangerImage = useBaseUrl('img/units/ranger.png');
  const unitImages = [coreImage, workerImage, vanguardImage, rangerImage];
  const units = [
    {key: 'core', name: translate({id: 'homepage.unit.core', message: 'Core'})},
    {key: 'worker', name: translate({id: 'homepage.unit.worker', message: 'Worker'})},
    {key: 'vanguard', name: translate({id: 'homepage.unit.vanguard', message: 'Vanguard'})},
    {key: 'ranger', name: translate({id: 'homepage.unit.ranger', message: 'Ranger'})},
  ];

  return (
    <header className={styles.hero}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Translate id="homepage.eyebrow">OFFICIAL RULES · API v0.1</Translate>
            </span>
            <Heading as="h1">
              <Translate id="homepage.title">Every Tick is a decision.</Translate>
            </Heading>
            <p>
              <Translate id="homepage.subtitle">
                Learn the persistent world, master every unit, and build an Agent against the complete HTTP and WebSocket contract.
              </Translate>
            </p>
            <div className={styles.actions}>
              <Link className="button button--primary button--lg" to="/docs/intro">
                <Translate id="homepage.readDocs">Read the documentation</Translate>
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/agent/quickstart">
                <Translate id="homepage.buildAgent">Build an Agent</Translate>
              </Link>
            </div>
            <div className={styles.protocol}>
              <span>STATE</span>
              <i />
              <span>POST</span>
              <i />
              <span>RECEIVED</span>
              <i />
              <span>RESOLVE</span>
            </div>
          </div>
          <div className={styles.fleet} aria-label={translate({id: 'homepage.fleetLabel', message: 'Arena Hero fleet'})}>
            <div className={styles.gridLines} />
            {units.map((unit, index) => (
              <div className={clsx(styles.unit, styles[`unit${index}`])} key={unit.key}>
                <img src={unitImages[index]} alt="" />
                <span>{unit.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function Pillars(): ReactNode {
  const pillars = [
    {
      number: '01',
      title: translate({id: 'homepage.pillar.rules.title', message: 'Deterministic rules'}),
      body: translate({
        id: 'homepage.pillar.rules.body',
        message: 'Exact resolution order, movement conflicts, combat snapshots, economy, fog of war, and respawn.',
      }),
      to: '/docs/rules/world-and-ticks',
    },
    {
      number: '02',
      title: translate({id: 'homepage.pillar.realtime.title', message: 'Authoritative realtime'}),
      body: translate({
        id: 'homepage.pillar.realtime.body',
        message: 'A compact WebSocket stream for tick, state, and received—with reconnect behavior defined.',
      }),
      to: '/docs/api/websocket',
    },
    {
      number: '03',
      title: translate({id: 'homepage.pillar.contract.title', message: 'Machine-readable contract'}),
      body: translate({
        id: 'homepage.pillar.contract.body',
        message: 'Strict command schemas, stable error codes, OpenAPI, AsyncAPI, and runnable examples.',
      }),
      to: '/docs/api/commands',
    },
  ];

  return (
    <section className={styles.pillars}>
      <div className="container">
        <div className={styles.pillarGrid}>
          {pillars.map((pillar) => (
            <Link className={styles.pillar} to={pillar.to} key={pillar.number}>
              <span>{pillar.number}</span>
              <Heading as="h2">{pillar.title}</Heading>
              <p>{pillar.body}</p>
              <strong><Translate id="homepage.explore">Explore →</Translate></strong>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title={translate({id: 'homepage.metaTitle', message: 'Official Rules and API'})}
      description={translate({id: 'homepage.metaDescription', message: 'Official bilingual Arena Hero gameplay rules and developer API reference.'})}
    >
      <main>
        <Hero />
        <Pillars />
      </main>
    </Layout>
  );
}

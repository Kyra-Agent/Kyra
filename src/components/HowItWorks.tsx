import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Rocket,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { currentProductChain, currentWalletDisplayName } from "../config/productChains";
import { RevealHeading } from "./RevealHeading";

const storySteps = [
  {
    id: "deploy",
    icon: Rocket,
    title: "Deploy an agent",
    copy:
      "Pick a template, name the agent, and publish its profile. Records stay in your private account workspace.",
  },
  {
    id: "telegram",
    icon: Send,
    title: "Connect Telegram",
    copy:
      "Paste your BotFather token once. It is stored backend-only and never returned to the browser.",
  },
  {
    id: "chat",
    icon: MessageSquareText,
    title: "Ask in plain language",
    copy:
      "Chat with the bot or use /status, /modules, and /policy. Telegram replies are read-only and never move funds.",
  },
  {
    id: "approve",
    icon: Wallet,
    title: "Approve in your wallet",
    copy:
      "Onchain actions are prepared as reviews in your private dashboard. Nothing is sent until you sign in your wallet.",
  },
] as const;

type StoryStepId = (typeof storySteps)[number]["id"];

function StoryVisual({ stepId }: { stepId: StoryStepId }) {
  if (stepId === "deploy") {
    return (
      <div className="story-visual story-visual-deploy">
        <div className="story-card-row">
          <span className="story-avatar"><Bot size={18} /></span>
          <div>
            <strong>Operator agent</strong>
            <small>Template · {currentProductChain.name}</small>
          </div>
        </div>
        <div className="story-progress"><span /></div>
        <ul className="story-checklist">
          <li><CheckCircle2 size={14} /> Workspace created</li>
          <li><CheckCircle2 size={14} /> Actions reviewed</li>
          <li><CheckCircle2 size={14} /> Public profile live</li>
        </ul>
      </div>
    );
  }

  if (stepId === "telegram") {
    return (
      <div className="story-visual story-visual-telegram">
        <label className="story-field">
          <span>Bot token</span>
          <span className="story-token">
            <KeyRound size={14} />
            <span className="story-token-mask">••••••••:••••••••••••</span>
          </span>
        </label>
        <div className="story-link-line">
          <span className="story-node">Kyra backend</span>
          <span className="story-wire"><span /></span>
          <span className="story-node">Telegram</span>
        </div>
        <span className="story-badge"><LockKeyhole size={13} /> Stored backend-only</span>
      </div>
    );
  }

  if (stepId === "chat") {
    return (
      <div className="story-visual story-visual-chat">
        <p className="story-bubble story-bubble-user">/status</p>
        <p className="story-bubble story-bubble-agent story-typing">
          <span /><span /><span />
        </p>
        <p className="story-bubble story-bubble-agent story-reply">
          Agent online on {currentProductChain.name}. Read-only mode: I can explain, check, and
          plan — execution waits for your approval.
        </p>
      </div>
    );
  }

  return (
    <div className="story-visual story-visual-approve">
      <div className="story-card-row">
        <span className="story-avatar"><ShieldCheck size={18} /></span>
        <div>
          <strong>Review prepared action</strong>
          <small>Private dashboard · {currentProductChain.name}</small>
        </div>
      </div>
      <dl className="story-review">
        <div><dt>Risk check</dt><dd>Passed</dd></div>
        <div><dt>Gas payer</dt><dd>Your wallet</dd></div>
      </dl>
      <div className="story-sign">
        <span className="story-sign-pulse" />
        <Wallet size={15} />
        Waiting for {currentWalletDisplayName} signature
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  // The step crossing the middle of the viewport drives the sticky visual.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.storyIndex);

            if (Number.isInteger(index)) {
              setActiveIndex(index);
            }
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    stepRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  const activeStep = storySteps[activeIndex] ?? storySteps[0];

  return (
    <section className="section story-section" id="how-it-works">
      <div className="section-heading">
        <p className="eyebrow">How Kyra works</p>
        <RevealHeading text="From template to signed action in four steps." />
        <p>
          Kyra prepares and explains. You stay in control of every key, token, and signature.
        </p>
      </div>

      <div className="story-layout">
        <ol className="story-steps">
          {storySteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                className={`story-step${index === activeIndex ? " is-active" : ""}`}
                data-story-index={index}
                key={step.id}
                ref={(element) => {
                  stepRefs.current[index] = element;
                }}
              >
                <span className="story-step-marker" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div className="story-step-copy">
                  <span className="story-step-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
                <div className="story-inline-visual" aria-hidden="true">
                  <StoryVisual stepId={step.id} />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="story-stage" aria-hidden="true">
          <div className="story-stage-frame">
            <div className="story-stage-dots">
              {storySteps.map((step, index) => (
                <span className={index === activeIndex ? "is-active" : ""} key={step.id} />
              ))}
            </div>
            <div className="story-stage-body" key={activeStep.id}>
              <StoryVisual stepId={activeStep.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

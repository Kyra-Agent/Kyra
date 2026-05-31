import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "../data/faqs";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section faq-section" id="faq">
      <div className="section-heading">
        <p className="eyebrow">FAQ</p>
        <h2>Questions users should not have to guess.</h2>
        <p>Clear trust language matters when a product touches wallet approvals.</p>
      </div>

      <div className="faq-list">
        {faqs.map((faq, index) => {
          const open = openIndex === index;

          return (
            <article className={`faq-item ${open ? "is-open" : ""}`} key={faq.question}>
              <button type="button" onClick={() => setOpenIndex(open ? -1 : index)}>
                <span>{faq.question}</span>
                <ChevronDown size={18} />
              </button>
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

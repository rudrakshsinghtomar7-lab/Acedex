// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// STEP 1 fixture — hardcoded stand-in for the AI brief-to-draft response. The
// real Edge Function (Step 2+) returns exactly this JSON shape; nothing here
// changes when the API lands, so the schema is locked by this file.
//
// Shape (contract):
//   {
//     description: string,                 // 2-3 sentence project description
//     milestones: [{
//       name: string,                      // short milestone name
//       tasks: [{ name: string, description: string }]  // desc: one line, ≤15 words
//     }]
//   }
//
// RULE: no dates anywhere. Dates are the professor's alone, set in the review UI.
// Treated as UNTRUSTED input by parseDraft() — do not rely on this being clean.

const FIXTURE = {
  description:
    'A semester-long study measuring how retrieval-augmented generation affects factual accuracy in open-domain question answering. Teams build a small RAG pipeline, run a controlled evaluation, and report where grounding helps and where it fails.',
  milestones: [
    {
      name: 'Scope & literature review',
      tasks: [
        { name: 'Define the research question', description: 'Write one testable hypothesis about RAG and factual accuracy.' },
        { name: 'Survey prior work', description: 'Summarize five recent papers on retrieval-augmented generation.' },
        { name: 'Pick evaluation datasets', description: 'Choose two open-domain QA benchmarks with gold answers.' },
      ],
    },
    {
      name: 'Build the pipeline',
      tasks: [
        { name: 'Set up the retriever', description: 'Index a document corpus and return top-k passages per query.' },
        { name: 'Wire the generator', description: 'Feed retrieved context to the model and capture answers.' },
        { name: 'Add a no-retrieval baseline', description: 'Run the same model without any retrieved context.' },
        { name: 'Log every run', description: 'Store queries, contexts, and outputs for later analysis.' },
      ],
    },
    {
      name: 'Evaluate & analyze',
      tasks: [
        { name: 'Score answer accuracy', description: 'Compare model answers against gold labels on both sets.' },
        { name: 'Measure grounding', description: 'Check whether answers are supported by retrieved passages.' },
        { name: 'Error analysis', description: 'Categorize the twenty most common failure cases.' },
      ],
    },
    {
      name: 'Write-up & presentation',
      tasks: [
        { name: 'Draft the report', description: 'Cover method, results, and threats to validity.' },
        { name: 'Build result figures', description: 'Plot accuracy and grounding across both baselines.' },
        { name: 'Prepare the talk', description: 'Ten-minute presentation with a live demo.' },
      ],
    },
  ],
};

// Async accessor — mirrors a real fetch so the call site already looks like the
// API path. Returns a deep copy so consumers can't mutate the shared fixture.
export function getDraftFixture() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(JSON.parse(JSON.stringify(FIXTURE))), 260);
  });
}

export default FIXTURE;

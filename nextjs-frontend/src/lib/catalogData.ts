// Static model catalog — mirrors backend model-catalog.service.ts
// Used as fallback when the API is unavailable (Vercel demo without backend)

export interface CatalogModel {
  id: string;
  name: string;
  params: string;
  paramsB: number;
  contextWindow: number;
  license: string;
  licenseType: string;
  useCase: string;
  huggingfaceId: string;
  architecture: string;
  tags: string[];
  vramRequiredGb: { qlora: number; lora: number; full: number };
  supportedMethods: string[];
  isMoE: boolean;
  activeParams?: string;
  downloads: number;
  stars: number;
}

export const CATALOG: CatalogModel[] = [
  {
    id: 'llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    params: '8B', paramsB: 8, contextWindow: 131072,
    license: 'Meta Llama 3.1 Community', licenseType: 'meta',
    useCase: 'Chat, instruction following, fine-tuning baseline on consumer GPUs',
    huggingfaceId: 'meta-llama/Llama-3.1-8B-Instruct',
    architecture: 'LLaMA', tags: ['chat', 'instruction', 'multilingual'],
    vramRequiredGb: { qlora: 12, lora: 24, full: 80 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 12400000, stars: 9200,
  },
  {
    id: 'llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    params: '70B', paramsB: 70, contextWindow: 131072,
    license: 'Meta Llama 3.1 Community', licenseType: 'meta',
    useCase: 'High-quality reasoning, multilingual tasks, production inference',
    huggingfaceId: 'meta-llama/Llama-3.1-70B-Instruct',
    architecture: 'LLaMA', tags: ['chat', 'reasoning', 'multilingual', 'production'],
    vramRequiredGb: { qlora: 48, lora: 160, full: 560 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: false, downloads: 5600000, stars: 7800,
  },
  {
    id: 'llama-4-scout',
    name: 'Llama 4 Scout',
    params: '109B total', paramsB: 17, contextWindow: 10000000,
    license: 'Llama 4 Community', licenseType: 'llama4',
    useCase: 'Ultra-long context RAG, large codebase analysis, document intelligence',
    huggingfaceId: 'meta-llama/Llama-4-Scout-17B-16E',
    architecture: 'LLaMA-MoE', tags: ['long-context', 'rag', 'moe', 'multimodal'],
    vramRequiredGb: { qlora: 24, lora: 48, full: 200 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: true, activeParams: '17B active (16 experts)',
    downloads: 980000, stars: 4100,
  },
  {
    id: 'mistral-7b-instruct-v0.3',
    name: 'Mistral 7B Instruct v0.3',
    params: '7.3B', paramsB: 7.3, contextWindow: 32768,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Budget fine-tuning baseline, single-GPU production chat',
    huggingfaceId: 'mistralai/Mistral-7B-Instruct-v0.3',
    architecture: 'Mistral', tags: ['chat', 'instruction', 'efficient'],
    vramRequiredGb: { qlora: 10, lora: 22, full: 60 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 8900000, stars: 6500,
  },
  {
    id: 'mistral-small-4',
    name: 'Mistral Small 4',
    params: '119B total', paramsB: 6.5, contextWindow: 262144,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Production chatbots, function calling, cost-efficient multilingual inference',
    huggingfaceId: 'mistralai/Mistral-Small-4-119B-2603',
    architecture: 'Mistral-MoE', tags: ['chat', 'function-calling', 'moe', 'multilingual'],
    vramRequiredGb: { qlora: 16, lora: 32, full: 240 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: true, activeParams: '6.5B active',
    downloads: 1200000, stars: 3200,
  },
  {
    id: 'phi-4',
    name: 'Phi-4',
    params: '14B', paramsB: 14, contextWindow: 16384,
    license: 'MIT', licenseType: 'mit',
    useCase: 'Reasoning, code review, tutoring — ideal for low-VRAM fine-tuning',
    huggingfaceId: 'microsoft/Phi-4',
    architecture: 'Phi', tags: ['reasoning', 'code', 'efficient', 'math'],
    vramRequiredGb: { qlora: 14, lora: 28, full: 112 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 3400000, stars: 5100,
  },
  {
    id: 'phi-4-reasoning',
    name: 'Phi-4-reasoning',
    params: '14B', paramsB: 14, contextWindow: 32768,
    license: 'MIT', licenseType: 'mit',
    useCase: 'Multi-step problem solving, math and science Q&A on edge hardware',
    huggingfaceId: 'microsoft/Phi-4-reasoning',
    architecture: 'Phi', tags: ['reasoning', 'math', 'science', 'chain-of-thought'],
    vramRequiredGb: { qlora: 14, lora: 28, full: 112 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 1800000, stars: 3900,
  },
  {
    id: 'gemma-4-26b-a4b',
    name: 'Gemma 4 26B-A4B',
    params: '25.2B total', paramsB: 3.8, contextWindow: 262144,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Local coding assistants, private document analysis, offline agents',
    huggingfaceId: 'google/gemma-4-26B-A4B-it',
    architecture: 'Gemma-MoE', tags: ['code', 'documents', 'moe', 'long-context'],
    vramRequiredGb: { qlora: 10, lora: 20, full: 120 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: true, activeParams: '3.8B active',
    downloads: 2100000, stars: 4600,
  },
  {
    id: 'qwen2.5-7b-instruct',
    name: 'Qwen2.5-7B Instruct',
    params: '7B', paramsB: 7, contextWindow: 131072,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Multilingual chat, code generation, Asian-language applications',
    huggingfaceId: 'Qwen/Qwen2.5-7B-Instruct',
    architecture: 'Qwen', tags: ['multilingual', 'code', 'chat', 'chinese'],
    vramRequiredGb: { qlora: 10, lora: 22, full: 60 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 6700000, stars: 5800,
  },
  {
    id: 'qwen3-235b-a22b',
    name: 'Qwen3-235B-A22B',
    params: '235B total', paramsB: 22, contextWindow: 262144,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Frontier-quality multilingual apps, enterprise fine-tuning',
    huggingfaceId: 'Qwen/Qwen3-235B-A22B',
    architecture: 'Qwen-MoE', tags: ['multilingual', 'reasoning', 'moe', 'frontier'],
    vramRequiredGb: { qlora: 32, lora: 80, full: 480 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: true, activeParams: '22B active',
    downloads: 890000, stars: 3700,
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    params: '671B total', paramsB: 37, contextWindow: 131072,
    license: 'MIT', licenseType: 'mit',
    useCase: 'Chain-of-thought reasoning, math (MATH-500 SOTA), science, debugging',
    huggingfaceId: 'deepseek-ai/DeepSeek-R1',
    architecture: 'DeepSeek-MoE', tags: ['reasoning', 'math', 'moe', 'chain-of-thought'],
    vramRequiredGb: { qlora: 48, lora: 120, full: 800 },
    supportedMethods: ['qlora', 'lora', 'dpo'],
    isMoE: true, activeParams: '37B active',
    downloads: 4500000, stars: 8900,
  },
  {
    id: 'deepseek-r1-distill-qwen-7b',
    name: 'DeepSeek-R1-Distill-Qwen-7B',
    params: '7B', paramsB: 7, contextWindow: 131072,
    license: 'MIT', licenseType: 'mit',
    useCase: 'Practical local reasoning — distilled from R1 for affordable deployment',
    huggingfaceId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    architecture: 'Qwen', tags: ['reasoning', 'distilled', 'efficient', 'math'],
    vramRequiredGb: { qlora: 10, lora: 22, full: 60 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 3200000, stars: 5400,
  },
  {
    id: 'falcon-40b',
    name: 'Falcon 40B',
    params: '40B', paramsB: 40, contextWindow: 2048,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Research baseline; widely cited in fine-tuning literature',
    huggingfaceId: 'tiiuae/falcon-40b',
    architecture: 'Falcon', tags: ['research', 'baseline', 'text-generation'],
    vramRequiredGb: { qlora: 28, lora: 80, full: 320 },
    supportedMethods: ['qlora', 'lora', 'full'],
    isMoE: false, downloads: 1100000, stars: 2900,
  },
  {
    id: 'yi-34b-chat',
    name: 'Yi-34B-Chat',
    params: '34B', paramsB: 34, contextWindow: 4096,
    license: 'Apache 2.0', licenseType: 'apache-2.0',
    useCase: 'Bilingual Chinese/English chat and instruction following',
    huggingfaceId: '01-ai/Yi-34B-Chat',
    architecture: 'Yi', tags: ['bilingual', 'chinese', 'chat', 'instruction'],
    vramRequiredGb: { qlora: 24, lora: 68, full: 272 },
    supportedMethods: ['qlora', 'lora', 'full', 'dpo'],
    isMoE: false, downloads: 780000, stars: 2400,
  },
];

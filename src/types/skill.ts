export type SkillFact = {
  question: string;
  answer: string;
};

export type SkillInformation = {
  responseTemplate?: string;
  sources?: string[];
};

export type Skill = {
  id: string;
  title: string;
  tags: string[];
  content: string;
  quickFacts: SkillFact[];
  edgeCases: string[];
  information?: SkillInformation;
  isActive: boolean;
  createdAt: string;
  lastRefreshedAt?: string;
  lastSourceLink?: string;
};

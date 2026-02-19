// Template engine type definitions

export type TemplateKind = 'agent' | 'section' | 'pipeline';

// --- Conditions ---

export interface HasCondition {
  has: string;
}

export interface EqCondition {
  eq: [string, string];
}

export interface InCondition {
  in: [string, string];
}

export interface AndCondition {
  and: Condition[];
}

export interface OrCondition {
  or: Condition[];
}

export interface NotCondition {
  not: Condition;
}

export type Condition =
  | HasCondition
  | EqCondition
  | InCondition
  | AndCondition
  | OrCondition
  | NotCondition;

// --- Sections ---

export interface TextSection {
  type: 'text';
  text: string;
}

export interface HeadingSection {
  type: 'heading';
  heading: string;
  level?: number;
}

export interface IncludeSection {
  type: 'include';
  include: string;
  params?: Record<string, unknown>;
}

export interface EachSection {
  type: 'each';
  each: string;
  as: string;
  template?: string;
  sections?: Section[];
  limit?: number;
}

export interface ConditionSection {
  type: 'condition';
  if: Condition;
  then: Section[];
  else?: Section[];
}

export interface SchemaSection {
  type: 'schema';
  source: string;
  format: string;
  label?: string;
}

export interface LetSection {
  type: 'let';
  let: Record<string, unknown>;
  sections: Section[];
}

export interface SwitchCase {
  when: unknown;
  then: Section[];
}

export interface SwitchSection {
  type: 'switch';
  switch: string;
  cases: SwitchCase[];
  default?: Section[];
}

export type Section =
  | TextSection
  | HeadingSection
  | IncludeSection
  | EachSection
  | ConditionSection
  | SchemaSection
  | LetSection
  | SwitchSection;

// --- Document ---

export interface TemplateBlock {
  sections: Section[];
}

export interface TemplateDocument {
  meta: {
    agent?: string;
    name?: string;
    version: number;
  };
  system?: TemplateBlock;
  user?: TemplateBlock;
  blocks?: Record<string, TemplateBlock>;
  templates?: Record<string, string>;
}

// --- Context ---

export type TemplateContext = Record<string, unknown>;

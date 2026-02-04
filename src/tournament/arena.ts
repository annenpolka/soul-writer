import type { LLMClient } from '../llm/types.js';
import type { SoulText } from '../soul/manager.js';
import { WriterAgent, DEFAULT_WRITERS, type WriterConfig } from '../agents/writer.js';
import { JudgeAgent, type JudgeResult } from '../agents/judge.js';
import type { GenerationResult, ThemeContext } from '../agents/types.js';
import type { NarrativeRules } from '../factory/narrative-rules.js';
import type { DevelopedCharacter } from '../factory/character-developer.js';
import type { Logger } from '../logger.js';

/**
 * Result of a single match in the tournament
 */
export interface MatchResult {
  matchName: string;
  contestantA: string;
  contestantB: string;
  winner: string;
  judgeResult: JudgeResult;
}

/**
 * Complete tournament result
 */
export interface TournamentResult {
  champion: string;
  championText: string;
  rounds: MatchResult[];
  allGenerations: GenerationResult[];
  totalTokensUsed: number;
}

/**
 * Tournament arena for running writer competitions
 */
export class TournamentArena {
  private llmClient: LLMClient;
  private soulText: SoulText;
  private writerConfigs: WriterConfig[];
  private narrativeRules?: NarrativeRules;
  private developedCharacters?: DevelopedCharacter[];
  private themeContext?: ThemeContext;
  private logger?: Logger;

  constructor(
    llmClient: LLMClient,
    soulText: SoulText,
    writerConfigs: WriterConfig[] = DEFAULT_WRITERS,
    narrativeRules?: NarrativeRules,
    developedCharacters?: DevelopedCharacter[],
    themeContext?: ThemeContext,
    logger?: Logger,
  ) {
    this.llmClient = llmClient;
    this.soulText = soulText;
    this.writerConfigs = writerConfigs;
    this.narrativeRules = narrativeRules;
    this.developedCharacters = developedCharacters;
    this.themeContext = themeContext;
    this.logger = logger;
  }

  /**
   * Run a full tournament with 4 writers
   */
  async runTournament(prompt: string): Promise<TournamentResult> {
    const tokensStart = this.llmClient.getTotalTokens();

    // Create writers
    const writers = this.writerConfigs.map(
      (config) => new WriterAgent(this.llmClient, this.soulText, config, this.narrativeRules, this.developedCharacters, this.themeContext)
    );

    // Generate texts from all writers
    const generations = await this.generateAllTexts(writers, prompt);

    // Verbose: log all writer generations
    if (this.logger) {
      this.logger.section('Tournament: Writer Generations');
      for (const gen of generations) {
        this.logger.debug(`${gen.writerId} (${gen.text.length}文字, ${gen.tokensUsed} tokens)`, gen.text);
      }
    }

    // Run tournament bracket
    const rounds: MatchResult[] = [];

    // Semifinal 1: Writer 1 vs Writer 2
    const semi1 = await this.runMatch(
      'semifinal_1',
      generations[0],
      generations[1]
    );
    rounds.push(semi1);
    this.logMatchResult(semi1);

    // Semifinal 2: Writer 3 vs Writer 4
    const semi2 = await this.runMatch(
      'semifinal_2',
      generations[2],
      generations[3]
    );
    rounds.push(semi2);
    this.logMatchResult(semi2);

    // Final: Winner of Semi1 vs Winner of Semi2
    const finalist1 = this.getGenerationByWriterId(generations, semi1.winner);
    const finalist2 = this.getGenerationByWriterId(generations, semi2.winner);
    const final = await this.runMatch('final', finalist1, finalist2);
    rounds.push(final);
    this.logMatchResult(final);

    // Get champion's text
    const championGeneration = this.getGenerationByWriterId(
      generations,
      final.winner
    );

    this.logger?.section(`Tournament Champion: ${final.winner}`);

    return {
      champion: final.winner,
      championText: championGeneration.text,
      rounds,
      allGenerations: generations,
      totalTokensUsed: this.llmClient.getTotalTokens() - tokensStart,
    };
  }

  private async generateAllTexts(
    writers: WriterAgent[],
    prompt: string
  ): Promise<GenerationResult[]> {
    // Generate in parallel
    const results = await Promise.all(
      writers.map((writer) => writer.generateWithMetadata(prompt))
    );
    return results;
  }

  private async runMatch(
    matchName: string,
    generationA: GenerationResult,
    generationB: GenerationResult
  ): Promise<MatchResult> {
    const judge = new JudgeAgent(this.llmClient, this.soulText, this.narrativeRules, this.themeContext);
    const judgeResult = await judge.evaluate(generationA.text, generationB.text);

    const winner =
      judgeResult.winner === 'A'
        ? generationA.writerId
        : generationB.writerId;

    return {
      matchName,
      contestantA: generationA.writerId,
      contestantB: generationB.writerId,
      winner,
      judgeResult,
    };
  }

  private logMatchResult(match: MatchResult): void {
    if (!this.logger) return;
    this.logger.debug(`Match ${match.matchName}: ${match.winner} wins (${match.contestantA} vs ${match.contestantB})`, {
      scores: match.judgeResult.scores,
      reasoning: match.judgeResult.reasoning,
    });
  }

  private getGenerationByWriterId(
    generations: GenerationResult[],
    writerId: string
  ): GenerationResult {
    const generation = generations.find((g) => g.writerId === writerId);
    if (!generation) {
      throw new Error(`Generation not found for writer: ${writerId}`);
    }
    return generation;
  }
}

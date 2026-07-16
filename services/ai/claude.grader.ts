import Anthropic from "@anthropic-ai/sdk";
import type { IAIGrader, GradingInput, GradingOutput } from "./ai-grader.interface";

export class ClaudeGrader implements IAIGrader {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async grade(input: GradingInput): Promise<GradingOutput> {
    const prompt = this.buildPrompt(input);

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return this.parseResponse(text, input.maxScore);
  }

  private buildPrompt(input: GradingInput): string {
    return `You are an academic grader. Grade the student's answer strictly based on the rubric.

Question: ${input.question}

Rubric: ${input.rubric}
${input.sampleAnswer ? `\nSample Answer: ${input.sampleAnswer}` : ""}

Student Answer: ${input.studentAnswer}

Maximum Score: ${input.maxScore}

Respond ONLY in this JSON format:
{
  "suggestedScore": <number 0 to ${input.maxScore}>,
  "strengths": ["<string>", ...],
  "weaknesses": ["<string>", ...],
  "suggestions": ["<string>", ...],
  "reasoning": "<brief explanation>"
}`;
  }

  private parseResponse(text: string, maxScore: number): GradingOutput {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestedScore: Math.min(Math.max(0, parsed.suggestedScore), maxScore),
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        suggestions: parsed.suggestions ?? [],
        reasoning: parsed.reasoning ?? "",
      };
    } catch {
      return {
        suggestedScore: 0,
        strengths: [],
        weaknesses: ["AI could not parse the answer"],
        suggestions: ["Please grade manually"],
        reasoning: text,
      };
    }
  }
}

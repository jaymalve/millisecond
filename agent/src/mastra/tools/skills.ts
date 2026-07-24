import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SKILL_NAMES, skills } from "../skills";

const skillMenu = Object.entries(skills)
  .map(([name, skill]) => `- ${name}: ${skill.description}`)
  .join("\n");

export const loadSkillTool = createTool({
  id: "load-skill",
  description: `Load the detailed investigation playbook for one domain — tool order, evidence bar, and final-answer shape. Call this first, before any other tool: the base instructions deliberately leave that guidance out of context until you know which domain applies. Available skills:\n${skillMenu}`,
  inputSchema: z.object({
    name: z.enum(SKILL_NAMES).describe("Which skill's playbook to load"),
  }),
  outputSchema: z.object({ content: z.string() }),
  execute: async ({ name }) => ({ content: skills[name].content }),
});

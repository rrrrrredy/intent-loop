function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateVisibleFinalRequirements(scenarios) {
  invariant(Array.isArray(scenarios) && scenarios.length > 0, "scenario corpus must be non-empty");
  for (const scenario of scenarios) {
    invariant(typeof scenario?.id === "string" && scenario.id.length > 0, "scenario id is required");
    invariant(
      typeof scenario.initial_prompt === "string" && scenario.initial_prompt.trim().length > 0,
      `initial prompt is required: ${scenario.id}`
    );
    invariant(
      Array.isArray(scenario.final_requirements) && scenario.final_requirements.length > 0,
      `final requirements are required: ${scenario.id}`
    );
    const visibleConversation = [scenario.initial_prompt, scenario.follow_up]
      .filter((value) => typeof value === "string")
      .join("\n");
    for (const requirement of scenario.final_requirements) {
      invariant(
        typeof requirement === "string" && [...requirement.trim()].length >= 4,
        `final requirement must be a non-trivial string: ${scenario.id}`
      );
      invariant(
        visibleConversation.includes(requirement),
        `final requirement is not an exact user-visible excerpt: ${scenario.id}`
      );
    }
  }
  return true;
}

export const PASS_RULES = {
  generalTotal: 15,
  roadSafetyTotal: 30,
  generalPass: 12,
  roadSafetyPass: 29,
  generalMaxWrong: 3,
  roadSafetyMaxWrong: 1,
};

export function summarizeMock(answers) {
  const general = answers.filter((answer) => answer.category === "general");
  const roadSafety = answers.filter((answer) => answer.category !== "general");
  const generalCorrect = general.filter((answer) => answer.correct).length;
  const roadSafetyCorrect = roadSafety.filter((answer) => answer.correct).length;
  const generalWrong = general.length - generalCorrect;
  const roadSafetyWrong = roadSafety.length - roadSafetyCorrect;
  const earlyFail = generalWrong > PASS_RULES.generalMaxWrong || roadSafetyWrong > PASS_RULES.roadSafetyMaxWrong;
  const complete = answers.length >= PASS_RULES.generalTotal + PASS_RULES.roadSafetyTotal;
  const passed = complete && generalCorrect >= PASS_RULES.generalPass && roadSafetyCorrect >= PASS_RULES.roadSafetyPass;

  return {
    generalCorrect,
    roadSafetyCorrect,
    generalWrong,
    roadSafetyWrong,
    complete,
    earlyFail,
    passed,
  };
}

export function shouldStopMock(answers) {
  return summarizeMock(answers).earlyFail;
}

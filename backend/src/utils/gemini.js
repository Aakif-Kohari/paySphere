const axios = require("axios");

const getLocalFallbackTags = (deck) => {
  const tags = new Set();
  if (deck.subject) tags.add(deck.subject.toLowerCase().trim());
  if (deck.exam) tags.add(deck.exam.toLowerCase().trim());
  
  if (deck.title) {
    deck.title.toLowerCase().split(/\s+/).forEach(word => {
      const cleanWord = word.replace(/[^a-z0-9]/g, "");
      if (cleanWord.length > 3) {
        tags.add(cleanWord);
      }
    });
  }
  return Array.from(tags).slice(0, 5);
};

const generateSummaryTags = async (deck) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return getLocalFallbackTags(deck);
  }

  try {
    const cardsText = deck.cards.map((c, i) => `${i + 1}. Front: "${c.front}" / Back: "${c.back}"`).join("\n");
    const prompt = `Analyze the following flashcard deck and generate 3 to 5 short summary tags (e.g. topic keywords, sub-topics, target concepts).
Return ONLY a valid JSON array of strings, like ["tag1", "tag2", "tag3"]. Do not include markdown code block formatting, explanation, or any other text.

Deck Title: ${deck.title}
Deck Description: ${deck.description || ""}
Subject: ${deck.subject}
Exam: ${deck.exam}
Cards:
${cardsText}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      return getLocalFallbackTags(deck);
    }

    const cleanText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedTags = JSON.parse(cleanText);
    if (Array.isArray(parsedTags)) {
      return parsedTags.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0);
    }
    return getLocalFallbackTags(deck);
  } catch (error) {
    return getLocalFallbackTags(deck);
  }
};

const getLocalFallbackTrend = (pyqs, forecastYear) => {
  const chapterCounts = {};
  const chapterDifficulties = {};

  pyqs.forEach((q) => {
    chapterCounts[q.chapter] = (chapterCounts[q.chapter] || 0) + 1;
    if (!chapterDifficulties[q.chapter]) {
      chapterDifficulties[q.chapter] = { easy: 0, medium: 0, hard: 0 };
    }
    chapterDifficulties[q.chapter][q.difficulty] += 1;
  });

  const totalQuestions = pyqs.length || 1;
  const topics = Object.keys(chapterCounts).map((chapter) => {
    const count = chapterCounts[chapter];
    const probability = Math.min(parseFloat((count / totalQuestions).toFixed(2)), 1.0);
    const diffs = chapterDifficulties[chapter];
    const difficultyMode = Object.keys(diffs).reduce((a, b) => (diffs[a] > diffs[b] ? a : b));

    let trend = "stable";
    if (probability > 0.4) trend = "rising";
    else if (probability < 0.1) trend = "falling";

    let weightageClass = "medium";
    if (probability > 0.3) weightageClass = "high";
    else if (probability < 0.15) weightageClass = "low";

    let badge = "Stable weightage";
    if (trend === "rising") {
      badge = `Rising Weightage in ${forecastYear}`;
    } else if (trend === "falling") {
      badge = "Declining Probability";
    } else if (weightageClass === "high") {
      badge = `High Probability in ${forecastYear}`;
    }

    return {
      chapter,
      probability,
      trend,
      weightageClass,
      badge,
    };
  });

  let hardCount = pyqs.filter((q) => q.difficulty === "hard").length;
  let easyCount = pyqs.filter((q) => q.difficulty === "easy").length;
  let predictedDifficulty = "medium";
  if (hardCount > pyqs.length / 3) predictedDifficulty = "hard";
  else if (easyCount > pyqs.length / 2) predictedDifficulty = "easy";

  return {
    predictedDifficulty,
    difficultyConfidence: 75,
    topics: topics.sort((a, b) => b.probability - a.probability),
  };
};

const generatePYQTrend = async (pyqs, subject, exam, forecastYear) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !pyqs || pyqs.length === 0) {
    return getLocalFallbackTrend(pyqs || [], forecastYear);
  }

  try {
    const pyqsText = pyqs
      .map(
        (q, idx) =>
          `${idx + 1}. Year: ${q.year} | Chapter: "${q.chapter}" | Difficulty: "${q.difficulty}" | Tags: [${(q.tags || []).join(", ")}]`
      )
      .join("\n");

    const prompt = `Analyze the following historical Past Year Questions (PYQs) for subject "${subject}" in "${exam}" and forecast predicted exam metrics for upcoming year "${forecastYear}".
Return ONLY a valid JSON object matching the schema below. Do not include markdown code block formatting, explanation, or any other text.

Schema:
{
  "predictedDifficulty": "easy|medium|hard",
  "difficultyConfidence": 85,
  "topics": [
    {
      "chapter": "Chapter Name",
      "probability": 0.85,
      "trend": "rising|falling|stable",
      "weightageClass": "high|medium|low",
      "badge": "Rising Weightage in ${forecastYear}"
    }
  ]
}

PYQs list:
${pyqsText}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      return getLocalFallbackTrend(pyqs, forecastYear);
    }

    const cleanText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanText);

    // Validate schema basic fields
    if (
      parsedData &&
      ["easy", "medium", "hard"].includes(parsedData.predictedDifficulty) &&
      typeof parsedData.difficultyConfidence === "number" &&
      Array.isArray(parsedData.topics)
    ) {
      return parsedData;
    }
    return getLocalFallbackTrend(pyqs, forecastYear);
  } catch (error) {
    return getLocalFallbackTrend(pyqs, forecastYear);
  }
};

module.exports = {
  generateSummaryTags,
  getLocalFallbackTags,
  generatePYQTrend,
  getLocalFallbackTrend,
};

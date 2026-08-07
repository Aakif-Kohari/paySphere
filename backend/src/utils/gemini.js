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

    // Strip out markdown formatting if any
    const cleanText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedTags = JSON.parse(cleanText);
    if (Array.isArray(parsedTags)) {
      return parsedTags.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0);
    }
    return getLocalFallbackTags(deck);
  } catch (error) {
    // Graceful fallback on API failure or parsing error
    return getLocalFallbackTags(deck);
  }
};

module.exports = {
  generateSummaryTags,
  getLocalFallbackTags,
};

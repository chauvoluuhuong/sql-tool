import { Tool } from "@langchain/core/tools";

// Weather tool - simulates getting weather information
class WeatherTool extends Tool {
  name = "get_weather";
  description = "Get the current weather for a specific location";

  protected async _call(input: string): Promise<string> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock weather data
    const weatherData: Record<
      string,
      { temp: string; condition: string; humidity: string }
    > = {
      "san francisco": {
        temp: "65°F",
        condition: "Partly cloudy",
        humidity: "70%",
      },
      "new york": { temp: "72°F", condition: "Sunny", humidity: "60%" },
      london: { temp: "55°F", condition: "Rainy", humidity: "85%" },
      tokyo: { temp: "78°F", condition: "Clear", humidity: "65%" },
    };

    const locationKey = input.toLowerCase();
    const weather = weatherData[locationKey] || {
      temp: "70°F",
      condition: "Unknown",
      humidity: "N/A",
    };

    return `Weather in ${input}: ${weather.temp}, ${weather.condition}, Humidity: ${weather.humidity}`;
  }
}

// Calculator tool - performs basic math operations
class CalculatorTool extends Tool {
  name = "calculator";
  description = "Perform basic mathematical calculations";

  protected async _call(input: string): Promise<string> {
    try {
      // Simple and safe evaluation - only allows basic math operations
      const sanitizedExpression = input.replace(/[^0-9+\-*/().\s]/g, "");
      const result = eval(sanitizedExpression);
      return `Result of ${input} = ${result}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error calculating ${input}: ${errorMessage}`;
    }
  }
}

// Time tool - gets current time for different timezones
class TimeTool extends Tool {
  name = "get_time";
  description = "Get the current time for a specific timezone or location";

  protected async _call(input: string): Promise<string> {
    try {
      const now = new Date();
      const timezone = input.toLowerCase();

      let timeString;
      switch (timezone) {
        case "utc":
          timeString = now.toUTCString();
          break;
        case "new york":
        case "america/new_york":
          timeString = now.toLocaleString("en-US", {
            timeZone: "America/New_York",
          });
          break;
        case "san francisco":
        case "america/los_angeles":
          timeString = now.toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
          });
          break;
        case "london":
        case "europe/london":
          timeString = now.toLocaleString("en-US", {
            timeZone: "Europe/London",
          });
          break;
        case "tokyo":
        case "asia/tokyo":
          timeString = now.toLocaleString("en-US", {
            timeZone: "Asia/Tokyo",
          });
          break;
        default:
          timeString = now.toLocaleString();
      }

      return `Current time in ${input}: ${timeString}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `Error getting time for ${input}: ${errorMessage}`;
    }
  }
}

// Search tool - simulates web search
class SearchTool extends Tool {
  name = "web_search";
  description = "Search for information on the web";

  protected async _call(input: string): Promise<string> {
    // Simulate search delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock search results
    const mockResults: Record<string, string> = {
      langchain:
        "LangChain is a framework for developing applications powered by language models. It provides tools for building LLM applications with composable chains and agents.",
      typescript:
        "TypeScript is a strongly typed programming language that builds on JavaScript, adding optional static types, classes, and modules.",
      openai:
        "OpenAI is an AI research and deployment company. They are the creators of GPT models and provide APIs for AI services.",
      weather:
        "Weather refers to the state of the atmosphere at a particular place and time, including temperature, humidity, precipitation, and wind.",
    };

    const queryKey = input.toLowerCase();
    const result =
      mockResults[queryKey] ||
      `Search results for "${input}": No specific information found, but this is a simulated search result.`;

    return result;
  }
}

export const tools = [
  new WeatherTool(),
  new CalculatorTool(),
  new TimeTool(),
  new SearchTool(),
];

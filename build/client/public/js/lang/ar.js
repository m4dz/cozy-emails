var fdLocale = {
fullMonths:["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0627\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0627\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0627\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"],
monthAbbrs:["\u064A\u0646\u0627", "\u0641\u0628\u0631", "\u0645\u0627\u0631", "\u0627\u0628\u0631", "\u0645\u0627\u064A", "\u064A\u0648\u0646", "\u064A\u0648\u0644", "\u0627\u063A\u0633", "\u0633\u0628\u062A", "\u0627\u0643\u062A", "\u0646\u0648\u0641", "\u062F\u064A\u0633"],
fullDays:["\u0627\u0644\u0627\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0627\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A", "\u0627\u0644\u0627\u062D\u062F"],
dayAbbrs:["\u0627\u062B\u0646\u064A\u0646", "\u062A\u0644\u0627\u062A", "\u0627\u0631\u0628\u0639", "\u062E\u0645\u064A\u0633", "\u062C\u0645\u0639\u0629", "\u0633\u0628\u062A", "\u0627\u062D\u062F"],
titles:["\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0633\u0627\u0628\u0642", "\u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0642\u0627\u062F\u0645", "\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629", "\u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629", "\u0627\u0644\u064A\u0648\u0645", "\u0627\u0639\u0631\u0636 \u0627\u0644\u0646\u062A\u064A\u062C\u0629", "\u0627\u0633\u0628\u0648\u0639", "Week [[%0%]] of [[%1%]]", "\u0627\u0633\u0628\u0648\u0639", "\u0627\u062E\u062A\u0627\u0631 \u0627\u0644\u062A\u0627\u0631\u064A\u062E", "\u0627\u0636\u063A\u0637 \u002D \u0627\u0633\u062D\u0628", "Display \u201C[[%0%]]\u201D first", "\u0627\u0630\u0647\u0628 \u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u064A\u0648\u0645", "\u0627\u0631\u0641\u0636 \u062A\u0627\u0631\u064A\u062E"],
rtl:1};
try {
        if("datePickerController" in window) {
                datePickerController.loadLanguage();
        };
} catch(err) {};

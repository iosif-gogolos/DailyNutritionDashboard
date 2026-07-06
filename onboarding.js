// onboarding.js — DailyNutritionDashboard
// Multi-step onboarding wizard that builds a copy-pasteable LLM prompt whose
// output CSV matches exactly what script.js's parser expects.

(function () {
  "use strict";

  const PROFILE_KEY = "dnd_user_profile";
  const ONBOARDING_DONE_KEY = "dnd_onboarding_complete";

  let currentStep = 1;
  const TOTAL_STEPS = 4;

  // ---------- Profile persistence ----------

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Could not read saved profile:", err);
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn("Could not save profile:", err);
    }
  }

  function readProfileFromForm() {
    return {
      heightCm: document.getElementById("obHeight").value,
      weightKg: document.getElementById("obWeight").value,
      age: document.getElementById("obAge").value,
      gender: document.getElementById("obGender").value,
      goal: document.getElementById("obGoal").value,
      diet: document.getElementById("obDiet").value,
      allergies: document.getElementById("obAllergies").value.trim(),
      wakeTime: document.getElementById("obWakeTime").value || "07:00",
      sleepTime: document.getElementById("obSleepTime").value || "23:00",
    };
  }

  function fillFormFromProfile(profile) {
    if (!profile) return;
    document.getElementById("obHeight").value = profile.heightCm || "";
    document.getElementById("obWeight").value = profile.weightKg || "";
    document.getElementById("obAge").value = profile.age || "";
    document.getElementById("obGender").value = profile.gender || "female";
    document.getElementById("obGoal").value = profile.goal || "General health";
    document.getElementById("obDiet").value = profile.diet || "No restriction";
    document.getElementById("obAllergies").value = profile.allergies || "";
    document.getElementById("obWakeTime").value = profile.wakeTime || "07:00";
    document.getElementById("obSleepTime").value = profile.sleepTime || "23:00";
  }

  // ---------- Prompt generation ----------
  // This schema MUST stay in sync with script.js's CSV parsing logic:
  //   - header row exactly: date,time,type,item,amount,unit,notes
  //   - date: YYYY-MM-DD, time: 24h HH:MM (parseRowTimestamp does `${date}T${time}:00`)
  //   - type: one of Hydration | Activity | Meal | Recovery
  //   - Hydration rows need unit "ml" to count toward the hydration total
  //   - Activity rows: amount = minutes, summed into activityMinutes
  //   - Meal rows: just counted; amount/unit can describe kcal or grams
  //   - Recovery rows with item "sleep" (case-insensitive): amount = hours

  function buildPrompt(profile, targetDate) {
    const allergyLine = profile.allergies
      ? `Avoid these allergens/foods entirely: ${profile.allergies}.`
      : "No known allergies.";

    return `You generate a single day's nutrition/hydration/activity/sleep log as a CSV file for a personal tracking app. Follow the format rules exactly — the app parses this CSV with strict column expectations.

MY PROFILE:
- Height: ${profile.heightCm} cm
- Weight: ${profile.weightKg} kg
- Age: ${profile.age}
- Gender: ${profile.gender}
- Goal: ${profile.goal}
- Dietary preference: ${profile.diet}
- ${allergyLine}
- Usual wake time: ${profile.wakeTime}
- Usual bedtime: ${profile.sleepTime}

TASK:
Create a realistic, complete plan for ${targetDate} that fits my profile and goal, covering hydration reminders, meals/snacks, at least one activity session, and a sleep/recovery entry.

OUTPUT FORMAT — return ONLY raw CSV text, no markdown code fences, no explanation before or after:

Header row (exact, lowercase, comma-separated):
date,time,type,item,amount,unit,notes

Column rules:
- date: YYYY-MM-DD (use ${targetDate} for every row)
- time: 24-hour HH:MM
- type: exactly one of "Hydration", "Activity", "Meal", "Recovery" (case-sensitive, no other values)
- item: short description (e.g. "Water", "Morning run", "Grilled chicken salad", "Sleep")
- amount: a plain number, no units inside it
- unit: "ml" for every Hydration row; "min" for every Activity row; "kcal" or "g" for Meal rows; "h" for the Recovery/sleep row
- notes: short free-text, may be empty but keep the column present

Include:
- 6–8 Hydration rows spaced through the day, amounts totalling roughly 2000–3000 ml depending on my weight and activity
- 3 Meal rows (breakfast, lunch, dinner) plus 1–2 Meal snack rows, respecting my dietary preference and allergies, with realistic kcal amounts for my profile and goal
- 1–2 Activity rows matching my goal (type of exercise in "item", duration in "amount" minutes)
- Exactly 1 Recovery row with item "sleep", amount = hours slept (based on my wake/bed times), unit "h"

Return nothing but the CSV.`;
  }

  // ---------- Wizard navigation ----------

  function showStep(step) {
    currentStep = step;
    document.querySelectorAll(".onboarding-step").forEach((section) => {
      section.hidden = Number(section.dataset.step) !== step;
    });
    document.querySelectorAll(".step-dot").forEach((dot) => {
      dot.classList.toggle("is-active", Number(dot.dataset.step) === step);
    });

    const backBtn = document.getElementById("onboardingBack");
    const nextBtn = document.getElementById("onboardingNext");
    const skipBtn = document.getElementById("onboardingSkip");

    backBtn.hidden = step === 1;
    skipBtn.hidden = step === TOTAL_STEPS;
    nextBtn.textContent = step === TOTAL_STEPS ? "Done" : "Next";

    if (step === 3) {
      generateAndShowPrompt();
    }
  }

  function generateAndShowPrompt() {
    const profile = readProfileFromForm();
    saveProfile(profile);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const prompt = buildPrompt(profile, today);
    document.getElementById("onboardingPromptOutput").value = prompt;
  }

  function goNext() {
    if (currentStep === 2) {
      const form = document.getElementById("onboardingProfileForm");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
    }
    if (currentStep === TOTAL_STEPS) {
      finishOnboarding();
      return;
    }
    showStep(currentStep + 1);
  }

  function goBack() {
    if (currentStep > 1) showStep(currentStep - 1);
  }

  function finishOnboarding() {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    closeOnboardingModal();
  }

  function skipOnboarding() {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    closeOnboardingModal();
  }

  // ---------- Open / close ----------

  function openOnboardingModal(startStep) {
    const modal = document.getElementById("onboardingModal");
    if (!modal) return;
    modal.hidden = false;

    const profile = loadProfile();
    if (profile) fillFormFromProfile(profile);

    showStep(startStep || 1);
  }

  function closeOnboardingModal() {
    const modal = document.getElementById("onboardingModal");
    if (modal) modal.hidden = true;
  }

  // Entry point for the recurring "Daily CSV Prompt" menu item —
  // jumps straight to step 3 using the saved profile, no re-entry needed.
  function openDailyPrompt() {
    const profile = loadProfile();
    if (!profile) {
      // No saved profile yet — send them through full onboarding instead
      openOnboardingModal(1);
      return;
    }
    const modal = document.getElementById("onboardingModal");
    modal.hidden = false;
    fillFormFromProfile(profile);
    showStep(3);
  }

  // ---------- Init ----------

  function setup() {
    const modal = document.getElementById("onboardingModal");
    if (!modal) return;

    document.getElementById("onboardingClose").addEventListener("click", closeOnboardingModal);
    document.getElementById("onboardingNext").addEventListener("click", goNext);
    document.getElementById("onboardingBack").addEventListener("click", goBack);
    document.getElementById("onboardingSkip").addEventListener("click", skipOnboarding);

    document.getElementById("onboardingCopyPrompt").addEventListener("click", () => {
      const textarea = document.getElementById("onboardingPromptOutput");
      navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = document.getElementById("onboardingCopyPrompt");
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = original), 1500);
      }).catch(() => {
        textarea.select();
        console.warn("Clipboard API unavailable — text selected for manual copy.");
      });
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeOnboardingModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeOnboardingModal();
    });

    // Hook up the hamburger menu item (add this button in your menu markup):
    // <li><button id="menuDailyPromptBtn" class="app-menu-item">Daily CSV Prompt</button></li>
    const dailyPromptBtn = document.getElementById("menuDailyPromptBtn");
    if (dailyPromptBtn) {
      dailyPromptBtn.addEventListener("click", () => {
        document.getElementById("appMenu").hidden = true;
        openDailyPrompt();
      });
    }

    // Auto-launch full onboarding on first visit only
    if (localStorage.getItem(ONBOARDING_DONE_KEY) !== "true") {
      openOnboardingModal(1);
    }
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
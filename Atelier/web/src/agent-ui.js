const agentPanel = byId("agent-panel");
const agentForm = byId("agent-form");
const agentQueueButton = byId("queue-agent");
const agentRuns = byId("agent-runs");
const agentFeedback = byId("agent-feedback");
const agentStateLabels = { queued: "Čeká na převzetí", running: "Agent pracuje", ready: "Návrh ke kontrole" };
const agentDateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Prague" });
let agentPlan = null;
let agentLoading = false;
let agentWrites = false;
let agentTimer;

function agentMessage(message, error = false) {
  agentFeedback.textContent = message;
  agentFeedback.className = message ? (error ? "form-error" : "claim-help") : "hidden";
}

function agentEndpoint(plan) {
  return "/api/agent-jobs/" + encodeURIComponent(plan.id);
}

function renderAgentJobs(jobs) {
  agentRuns.replaceChildren();
  const active = jobs.some(job => job.state === "queued" || job.state === "running");
  agentQueueButton.classList.toggle("hidden", active);
  byId("agent-note-field").classList.toggle("hidden", active);
  agentQueueButton.textContent = jobs.length ? "Zadat další návrh" : "Předat agentovi";
  for (const job of jobs) {
    const section = document.createElement("section");
    section.className = "agent-run";
    const heading = document.createElement("h3");
    const expired = job.state === "running" && new Date(job.leaseUntil).getTime() <= Date.now();
    heading.textContent = expired ? "Čeká na nové převzetí" : agentStateLabels[job.state];
    const stamp = document.createElement("small");
    stamp.textContent = agentDateFormat.format(new Date(job.updated));
    section.append(heading, stamp);
    if (job.brief.planUpdated !== agentPlan.updated) {
      const notice = document.createElement("p");
      notice.className = "claim-help";
      notice.textContent = "Agent má uloženou revizi plánu ze zadání.";
      section.append(notice);
    }
    if (job.brief.note) {
      const note = document.createElement("p");
      note.textContent = job.brief.note;
      section.append(note);
    }
    if (job.result) {
      const result = document.createElement("pre");
      result.className = "agent-result";
      result.textContent = job.result;
      section.append(result);
    } else if (job.state === "queued") {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "quiet";
      copy.textContent = "Zkopírovat pokyn pro ChatGPT";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText("Použij připojený Ateliér ZION TerraNova. Převezmi nejstarší zadanou tvůrčí úlohu, zpracuj podklady a ulož návrh do ateliéru. Pokud je fronta prázdná, nic neměň.");
          agentMessage("Pokyn je zkopírovaný.");
        } catch {
          agentMessage("Kopírování se nepodařilo. V ChatGPT požádej o převzetí úlohy z fronty ateliéru.", true);
        }
      });
      section.append(copy);
    }
    agentRuns.append(section);
  }
}

async function refreshAgentJobs() {
  if (agentLoading || !agentPanel.open) return;
  const plan = agentPlan;
  agentLoading = true;
  agentQueueButton.disabled = true;
  try {
    const jobs = await request(agentEndpoint(plan));
    if (agentPlan === plan && agentPanel.open) renderAgentJobs(jobs);
  } catch (error) {
    if (agentPlan === plan && agentPanel.open) agentMessage(error.message, true);
  } finally {
    agentLoading = false;
    agentQueueButton.disabled = agentWrites;
    if (agentPlan !== plan && agentPanel.open) refreshAgentJobs();
  }
}

function openAgentPanel(plan) {
  agentPlan = plan;
  agentForm.reset();
  agentRuns.replaceChildren();
  agentQueueButton.classList.remove("hidden");
  byId("agent-note-field").classList.remove("hidden");
  byId("agent-output").textContent = plan.output;
  agentMessage("");
  agentPanel.showModal();
  refreshAgentJobs();
  clearInterval(agentTimer);
  agentTimer = setInterval(refreshAgentJobs, 15000);
}

byId("close-agent").addEventListener("click", () => { if (!agentWrites) agentPanel.close(); });
byId("refresh-agent").addEventListener("click", refreshAgentJobs);
agentPanel.addEventListener("cancel", event => { if (agentWrites) event.preventDefault(); });
agentPanel.addEventListener("close", () => clearInterval(agentTimer));
agentForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (agentWrites || agentLoading) return;
  agentWrites = true;
  agentQueueButton.disabled = true;
  agentMessage("");
  try {
    await request(agentEndpoint(agentPlan), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: byId("agent-note").value }),
    });
    byId("agent-note").value = "";
    agentMessage("Zadání je ve frontě.");
  } catch (error) {
    agentMessage(error.message, true);
  } finally {
    agentWrites = false;
    agentQueueButton.disabled = false;
  }
  refreshAgentJobs();
});

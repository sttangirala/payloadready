"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Check } from "lucide-react";
import { addDays, formatISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const STEPS = ["Organization", "Mission", "Template"] as const;

const iso = (offset: number) => formatISO(addDays(new Date(), offset), { representation: "date" });

const TEMPLATES = [
  {
    key: "cubesat_standard" as const,
    title: "Standard CubeSat / small satellite",
    description: "Full readiness checklist across all ten categories — mechanical, electrical, RF, environmental, safety, and regulatory.",
  },
  {
    key: "hosted_payload" as const,
    title: "Hosted payload",
    description: "Same category structure, worded for a payload integrating onto a host spacecraft rather than a standalone bus.",
  },
  {
    key: "blank" as const,
    title: "Blank workspace",
    description: "Start with an empty checklist and add requirements yourself as your program defines them.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const createOrgAndMission = useStore((s) => s.createOrgAndMission);
  const [step, setStep] = useState(0);

  const [org, setOrg] = useState({ orgName: "" });
  const [mission, setMission] = useState({
    missionName: "",
    payloadName: "",
    missionType: "In-orbit technology demonstration",
    formFactor: "3U CubeSat",
    launchProvider: "",
    integrator: "",
    targetLaunchDate: iso(120),
    payloadDeliveryDate: iso(60),
    integrationDate: iso(90),
    phase: "Design & Development",
  });
  const [templateKey, setTemplateKey] = useState<"cubesat_standard" | "hosted_payload" | "blank">("cubesat_standard");

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function finish() {
    createOrgAndMission({ ...mission, ...org, templateKey });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
            <Rocket className="h-3.5 w-3.5 text-navy-800" />
          </div>
          <span className="text-[14px] font-semibold text-navy-950">PayloadReady setup</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <ol className="mb-8 flex items-center gap-3">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                  i < step ? "bg-green-600 text-white" : i === step ? "bg-navy-900 text-white" : "bg-surface-muted text-slate-400"
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("text-[13px]", i === step ? "font-medium text-navy-950" : "text-slate-500")}>{label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-border-strong" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-navy-950">Create your organization</h2>
              <p className="mt-1 text-[13px] text-slate-500">This is the workspace your whole program will share.</p>
            </div>
            <div>
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                placeholder="e.g. Meridian Orbital Systems"
                value={org.orgName}
                onChange={(e) => setOrg({ orgName: e.target.value })}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={next} disabled={!org.orgName.trim()}>
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-navy-950">Set up your first mission</h2>
              <p className="mt-1 text-[13px] text-slate-500">You can edit these details later from the mission workspace.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="missionName">Mission name</Label>
                <Input id="missionName" value={mission.missionName} onChange={(e) => setMission({ ...mission, missionName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="payloadName">Payload / spacecraft name</Label>
                <Input id="payloadName" value={mission.payloadName} onChange={(e) => setMission({ ...mission, payloadName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="missionType">Mission type</Label>
                <Input id="missionType" value={mission.missionType} onChange={(e) => setMission({ ...mission, missionType: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="formFactor">CubeSat form factor (if applicable)</Label>
                <Input id="formFactor" value={mission.formFactor} onChange={(e) => setMission({ ...mission, formFactor: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="launchProvider">Launch provider</Label>
                <Input id="launchProvider" placeholder="Fictional or illustrative" value={mission.launchProvider} onChange={(e) => setMission({ ...mission, launchProvider: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="integrator">Integrator / broker</Label>
                <Input id="integrator" placeholder="Fictional or illustrative" value={mission.integrator} onChange={(e) => setMission({ ...mission, integrator: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="deliveryDate">Payload delivery date</Label>
                <Input id="deliveryDate" type="date" value={mission.payloadDeliveryDate} onChange={(e) => setMission({ ...mission, payloadDeliveryDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="integrationDate">Integration date</Label>
                <Input id="integrationDate" type="date" value={mission.integrationDate} onChange={(e) => setMission({ ...mission, integrationDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="launchDate">Target launch date</Label>
                <Input id="launchDate" type="date" value={mission.targetLaunchDate} onChange={(e) => setMission({ ...mission, targetLaunchDate: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phase">Current mission phase</Label>
                <Select
                  id="phase"
                  value={mission.phase}
                  onChange={(e) => setMission({ ...mission, phase: e.target.value })}
                  options={[
                    "Concept & Feasibility",
                    "Design & Development",
                    "Environmental Test",
                    "Integration & Test",
                    "Pre-Ship Review",
                    "Shipped to Integrator",
                  ].map((p) => ({ value: p, label: p }))}
                />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={back}>
                Back
              </Button>
              <Button onClick={next} disabled={!mission.missionName.trim() || !mission.payloadName.trim()}>
                Continue
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-navy-950">Choose a checklist template</h2>
              <p className="mt-1 text-[13px] text-slate-500">You can add, edit, or remove items after setup.</p>
            </div>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplateKey(t.key)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                    templateKey === t.key ? "border-navy-800 bg-blue-100/50" : "border-border hover:bg-surface-muted"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      templateKey === t.key ? "border-navy-900 bg-navy-900" : "border-border-strong"
                    )}
                  >
                    {templateKey === t.key && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-navy-950">{t.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-slate-500">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={back}>
                Back
              </Button>
              <Button onClick={finish}>Create mission workspace</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

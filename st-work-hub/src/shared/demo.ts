// Default categories and clearly-labelled demo data. All demo dates are relative to `today` so the
// examples never go stale. Every demo record carries isDemo = true and can be removed in one step.

import { addDays, addBusinessDays, nextWeekday, ISODate } from './dates';
import { blankTask, newId } from './task';
import type { Category, Contact, Project, Source, Task, TaskPatch } from './types';
import { textHash } from './duplicates';

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Prospects and Sales', color: '#3b6fb6', position: 0, followUpDays: 3 },
  { name: 'Subscribers', color: '#2f8f83', position: 1, followUpDays: 2 },
  { name: 'Partners', color: '#7a5bb5', position: 2, followUpDays: 5 },
  { name: 'Experts', color: '#b5762f', position: 3, followUpDays: 3 },
  { name: 'Client Engagements', color: '#2f7a4f', position: 4, followUpDays: 2 },
  { name: 'Product and Technical Issues', color: '#b54a4a', position: 5, followUpDays: 2 },
  { name: 'Internal Operations', color: '#5a6b7d', position: 6, followUpDays: 3 },
  { name: 'Fundraising', color: '#9a4f86', position: 7, followUpDays: 5 },
  { name: 'Personal / Other', color: '#7d7d7d', position: 8, followUpDays: null },
];

export function makeDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId('cat') }));
}

export interface DemoData {
  tasks: Task[];
  contacts: Contact[];
  projects: Project[];
  sources: Source[];
}

/** Build the demo dataset. `categories` must contain the default category names. */
export function buildDemoData(today: ISODate, categories: Category[], nowIso: string): DemoData {
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const daysAgoIso = (n: number) => new Date(new Date(nowIso).getTime() - n * 86_400_000).toISOString();
  const t = (patch: TaskPatch, createdDaysAgo = 3): Task => {
    const created = daysAgoIso(createdDaysAgo);
    return { ...blankTask(created, patch), isDemo: true, tags: [...(patch.tags ?? []), 'demo'] };
  };

  const contacts: Contact[] = [
    { id: newId('ct'), name: 'Brenda', company: 'Amos Studios', status: 'active', notes: 'Client contact for the engagement review.', isDemo: true },
    { id: newId('ct'), name: 'Robert', company: 'Sobo', status: 'active', notes: 'Internal — legal & admin access.', isDemo: true },
    { id: newId('ct'), name: 'Curtis', company: 'Curtis Advisory', status: 'active', notes: 'NDA counterparty.', isDemo: true },
    { id: newId('ct'), name: 'Paulina', company: 'Brightline Partners', status: 'active', notes: 'Hosting an event on Monday.', isDemo: true },
    { id: newId('ct'), name: 'Stephanie Reese', company: 'Reese Consulting', status: 'closed', notes: 'Closed — asked for no further outreach.', isDemo: true },
    { id: newId('ct'), name: 'Naresh', company: 'Sobo', status: 'active', notes: 'Engineering.', isDemo: true },
    { id: newId('ct'), name: 'Aaron', company: 'Sobo', status: 'active', notes: 'Engineering.', isDemo: true },
  ];

  const brendaEmail = [
    'From: Brenda <brenda@amos-studios.example>',
    'Subject: Re: Engagement review',
    '',
    'Hi — thanks for the recap. Let me check with the team about timing for the engagement-review call',
    'and I will get back to you with a few options.',
    '',
    'Brenda',
  ].join('\n');
  const sources: Source[] = [
    {
      id: newId('src'),
      kind: 'email',
      title: '[Demo] Re: Engagement review — Brenda',
      rawText: brendaEmail,
      link: '',
      textHash: textHash(brendaEmail),
      isDemo: true,
      createdAt: daysAgoIso(2),
    },
  ];

  const project: Project = {
    id: newId('p'),
    name: '[Demo] Client engagement process',
    description: 'Define a repeatable engagement process: intake → scoping → expert match → review call.',
    status: 'active',
    milestones: [
      { id: newId('m'), title: 'Draft process outline', dueDate: nextWeekday(today, 6, true), done: false },
      { id: newId('m'), title: 'Pilot with Amos Studios review call', dueDate: addDays(today, 14), done: false },
      { id: newId('m'), title: 'Publish internal playbook', dueDate: null, done: false },
    ],
    isDemo: true,
    createdAt: daysAgoIso(5),
  };

  const upcomingMonday = nextWeekday(today, 1, true);
  const paulinaTuesday = addDays(upcomingMonday, 1);
  const saturday = nextWeekday(today, 6, true);

  const brenda = t(
    {
      title: '[Demo] Engagement-review call with Brenda (Amos Studios)',
      description: 'Waiting for Brenda to respond with times for the engagement-review call.',
      categoryId: cat('Client Engagements'),
      company: 'Amos Studios',
      contact: 'Brenda',
      projectId: project.id,
      status: 'waiting',
      importance: 'high',
      waitingOn: 'Brenda',
      waitingSince: addDays(today, -1),
      lastFollowUpDate: addDays(today, -1),
      isOutreach: true,
      requiresCall: true,
      nextAction: 'When Brenda replies, confirm a time and send the agenda.',
      sourceId: sources[0].id,
      effortMinutes: 45,
    },
    4,
  );

  const engagementOutline = t(
    {
      title: '[Demo] Draft the engagement process outline',
      description: 'Weekend work block. Outline the end-to-end engagement process.',
      categoryId: cat('Internal Operations'),
      projectId: project.id,
      status: 'scheduled',
      importance: 'high',
      nextActionDate: saturday,
      effortMinutes: 120,
      nextAction: 'Write the five process stages with owners and hand-offs.',
      checklist: [
        { id: newId('c'), text: 'List the stages', done: false },
        { id: newId('c'), text: 'Define the hand-off for each stage', done: false },
        { id: newId('c'), text: 'Note the tools used at each stage', done: false },
      ],
    },
    5,
  );

  const tasks: Task[] = [
    brenda,
    engagementOutline,
    t(
      {
        title: '[Demo] Update Sobo profile on Crunchbase',
        description: 'Need Robert to share the Crunchbase admin credentials before the profile can be updated.',
        categoryId: cat('Internal Operations'),
        company: 'Crunchbase',
        status: 'waiting',
        waitingOn: 'Robert',
        waitingSince: addDays(today, -7),
        importance: 'medium',
        nextAction: 'Ask Robert again for the Crunchbase credentials.',
        effortMinutes: 30,
      },
      7,
    ),
    t(
      {
        title: '[Demo] Review Curtis NDA',
        description: 'Robert owns the legal review. No action assigned to me.',
        categoryId: cat('Prospects and Sales'),
        contact: 'Curtis',
        company: 'Curtis Advisory',
        owner: 'Robert',
        status: 'in_progress',
        importance: 'medium',
      },
      3,
    ),
    t(
      {
        title: '[Demo] Follow up with Paulina after her Monday event',
        description: 'Paulina is busy with her event on Monday — follow up Tuesday.',
        categoryId: cat('Partners'),
        contact: 'Paulina',
        company: 'Brightline Partners',
        status: 'scheduled',
        nextActionDate: paulinaTuesday,
        isOutreach: true,
        importance: 'medium',
        nextAction: 'Send a short note asking how the event went and proposing next steps.',
        effortMinutes: 15,
      },
      2,
    ),
    t(
      {
        title: '[Demo] LA Expo follow-up emails',
        description: 'Sent follow-ups to everyone met at the LA Expo.',
        categoryId: cat('Prospects and Sales'),
        status: 'done',
        isOutreach: true,
        importance: 'medium',
      },
      3,
    ),
    t(
      {
        title: '[Demo] Awaiting replies from LA Expo contacts',
        description: 'Follow-up emails were sent yesterday; waiting for replies.',
        categoryId: cat('Prospects and Sales'),
        status: 'waiting',
        waitingOn: 'LA Expo contacts',
        waitingSince: addDays(today, -1),
        lastFollowUpDate: addDays(today, -1),
        isOutreach: true,
        importance: 'medium',
        nextAction: 'Log replies as they arrive; nudge non-responders on the next follow-up date.',
      },
      1,
    ),
    t(
      {
        title: '[Demo] Quarterly check-in with Stephanie Reese',
        description: 'Kept to demonstrate suppression: Stephanie is a closed contact, so this never appears as outreach.',
        categoryId: cat('Prospects and Sales'),
        contact: 'Stephanie Reese',
        company: 'Reese Consulting',
        status: 'ready',
        isOutreach: true,
        importance: 'low',
      },
      20,
    ),
    t(
      {
        title: '[Demo] Fix technical signup issue',
        description: 'New users intermittently see an error on the signup form. Naresh and Aaron own the fix.',
        categoryId: cat('Product and Technical Issues'),
        owner: 'Naresh and Aaron',
        status: 'in_progress',
        importance: 'high',
        urgency: 'urgent',
      },
      2,
    ),
    t(
      {
        title: '[Demo] Prepare monthly investor update',
        description: 'Monthly update to current investors: metrics, wins, asks.',
        categoryId: cat('Fundraising'),
        status: 'ready',
        importance: 'high',
        dueDate: addBusinessDays(today, 2),
        effortMinutes: 60,
        nextAction: 'Pull this month’s subscriber and engagement numbers.',
        checklist: [
          { id: newId('c'), text: 'Metrics table', done: false },
          { id: newId('c'), text: 'Three highlights', done: false },
          { id: newId('c'), text: 'Asks for investors', done: false },
        ],
      },
      4,
    ),
    t(
      {
        title: '[Demo] Review three new expert applications',
        categoryId: cat('Experts'),
        status: 'ready',
        importance: 'medium',
        effortMinutes: 25,
        nextAction: 'Open the applications and approve/decline each.',
      },
      1,
    ),
    t(
      {
        title: '[Demo] Answer subscriber question about renewal terms',
        categoryId: cat('Subscribers'),
        company: 'Northwind Analytics',
        status: 'ready',
        urgency: 'soon',
        importance: 'medium',
        isOutreach: true,
        effortMinutes: 20,
        nextAction: 'Reply with the renewal terms and the updated pricing sheet.',
      },
      1,
    ),
    t(
      {
        title: '[Demo] Intro request from a referral partner (unreviewed)',
        description: 'A partner offered an intro to a potential subscriber. Needs triage.',
        status: 'inbox',
        owner: '',
        reviewFlags: ['Owner not stated in the source — please assign.'],
      },
      0,
    ),
  ];

  const laDone = tasks.find((x) => x.title.startsWith('[Demo] LA Expo follow-up emails'))!;
  laDone.completedAt = daysAgoIso(1);

  return { tasks, contacts, projects: [project], sources };
}

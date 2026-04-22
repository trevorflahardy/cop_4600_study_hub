import type { ReactElement } from "react";
import { SchedulerAnimator } from "./SchedulerAnimator";
import { PageTableWalk } from "./PageTableWalk";
import { TlbSimulator } from "./TlbSimulator";
import { LockSimulator } from "./LockSimulator";
import { DiskScheduler } from "./DiskScheduler";
import { RaidLayout } from "./RaidLayout";
import { InodeLayout } from "./InodeLayout";

export interface VizDescriptor {
  id: string;
  title: string;
  description: string;
  render: () => ReactElement;
}

export const VIZ_FOR_TOPIC: Record<string, VizDescriptor> = {
  "02-scheduling/fifo": {
    id: "sched-fifo",
    title: "FIFO scheduler",
    description: "First-in, first-out: the simplest scheduler. Watch how waiting time can be terrible when a long job arrives early.",
    render: () => <SchedulerAnimator algorithm="fifo" />,
  },
  "02-scheduling/sjf": {
    id: "sched-sjf",
    title: "SJF scheduler",
    description: "Shortest job first (non-preemptive). Minimizes average turnaround but suffers from convoy effect and can starve long jobs.",
    render: () => <SchedulerAnimator algorithm="sjf" />,
  },
  "02-scheduling/stcf": {
    id: "sched-stcf",
    title: "STCF scheduler",
    description: "Shortest time-to-completion first (preemptive). Preempts if a shorter job arrives. Beats SJF on turnaround but bad for response time.",
    render: () => <SchedulerAnimator algorithm="stcf" />,
  },
  "02-scheduling/round-robin": {
    id: "sched-rr",
    title: "Round-robin scheduler",
    description: "Time-quantum based fairness. Adjust the quantum slider to see the tradeoff: small quantum = responsive but high overhead, large quantum = efficient but sluggish.",
    render: () => <SchedulerAnimator algorithm="rr" />,
  },
  "02-scheduling/mlfq": {
    id: "sched-mlfq",
    title: "MLFQ scheduler",
    description: "Multi-level feedback queue. Watches behavior to sort processes into priority tiers, aiming to be responsive and efficient.",
    render: () => <SchedulerAnimator algorithm="mlfq" />,
  },
  "02-scheduling/cfs": {
    id: "sched-cfs",
    title: "CFS scheduler",
    description: "Completely fair scheduler. Tracks virtual runtime (vruntime) and always picks the process with the smallest vruntime.",
    render: () => <SchedulerAnimator algorithm="cfs" />,
  },

  "03-memory/paging-math": {
    id: "paging-walk",
    title: "Page table walk (single-level)",
    description: "Input a virtual address and step through: extract VPN, look up PFN, combine with offset to get the physical address.",
    render: () => <PageTableWalk mode="single" />,
  },
  "03-memory/multi-level-page-tables": {
    id: "paging-multilevel",
    title: "Page table walk (two-level)",
    description: "Extend to two-level paging: outer directory index, inner table index, then the final PFN lookup.",
    render: () => <PageTableWalk mode="two-level" />,
  },
  "03-memory/tlb": {
    id: "tlb-sim",
    title: "TLB simulator",
    description: "Feed in a reference stream, watch TLB hits and misses accumulate. Toggle replacement policy and TLB size.",
    render: () => <TlbSimulator />,
  },

  "04-concurrency/spinlocks-and-ticket-locks": {
    id: "lock-ticket",
    title: "Ticket lock visualizer",
    description: "Fair spinlock using tickets: eliminate the thundering herd by letting each thread know its turn.",
    render: () => <LockSimulator primitive="ticket" />,
  },
  "04-concurrency/tas-cas-llsc-primitives": {
    id: "lock-tas",
    title: "TAS and CAS visualizer",
    description: "See why test-and-set spins inefficiently, why compare-and-swap is better, and how ticket locks scale beyond both.",
    render: () => <LockSimulator primitive="tas" />,
  },

  "06-persistence/04-disk-scheduling": {
    id: "disk-sched",
    title: "Disk scheduler",
    description: "Visualize disk head movement under FCFS, SSTF, SCAN, and C-SCAN. Watch total seek distance change as algorithm changes.",
    render: () => <DiskScheduler />,
  },
  "06-persistence/05-raid-levels": {
    id: "raid-layout",
    title: "RAID layout visualizer",
    description: "Stripe and mirror tradeoffs: toggle between levels 0, 1, 4, 5 and see capacity, read/write BW, and failure mode change.",
    render: () => <RaidLayout />,
  },
  "06-persistence/09-inode-multi-level-index": {
    id: "inode-index",
    title: "Inode multi-level index",
    description: "Crown jewel of file systems: watch the inode's direct, single-, double-, and triple-indirect pointers light up as file size grows (log scale).",
    render: () => <InodeLayout />,
  },
};

export function vizFor(slug: string): VizDescriptor | undefined {
  return VIZ_FOR_TOPIC[slug];
}

export const VIZ_CATALOG: (VizDescriptor & { topics: string[] })[] = (() => {
  const byId = new Map<string, { v: VizDescriptor; topics: string[] }>();
  for (const [slug, v] of Object.entries(VIZ_FOR_TOPIC)) {
    const existing = byId.get(v.id);
    if (existing) existing.topics.push(slug);
    else byId.set(v.id, { v, topics: [slug] });
  }
  return [...byId.values()].map(({ v, topics }) => ({ ...v, topics })).sort((a, b) => a.title.localeCompare(b.title));
})();

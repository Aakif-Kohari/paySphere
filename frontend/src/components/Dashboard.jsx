import { useEffect, useMemo, useState } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import dashboardMockup from "../assets/dashboard-mockup.png"

function SortableCard({ id, title, value, subtitle }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 p-5 shadow-xl"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
          drag
        </span>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
        {value}
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const defaultCards = useMemo(
    () => [
      {
        id: "card-1",
        title: "Total Net Payout",
        value: "₹4,82,51.50",
        subtitle: "12 Employees paid",
      },
      {
        id: "card-2",
        title: "Monthly Expense",
        value: "₹1,18,420",
        subtitle: "25 Transactions",
      },
      {
        id: "card-3",
        title: "Revenue Growth",
        value: "18.4%",
        subtitle: "vs last month",
      },
    ],
    []
  )

  const [cards, setCards] = useState(defaultCards)
  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    async function loadLayout() {
      try {
        const res = await fetch("/api/dashboard/layout")
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data.order)) return

        const ordered = data.order
          .map((id) => defaultCards.find((card) => card.id === id))
          .filter(Boolean)

        if (ordered.length === defaultCards.length) {
          setCards(ordered)
        }
      } catch (error) {
        console.error("Unable to load dashboard layout", error)
      }
    }

    loadLayout()
  }, [defaultCards])

  const saveLayout = async (order) => {
    try {
      await fetch("/api/dashboard/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      })
    } catch (error) {
      console.error("Unable to save dashboard layout", error)
    }
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return

    setCards((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      const nextItems = arrayMove(items, oldIndex, newIndex)
      saveLayout(nextItems.map((item) => item.id))
      return nextItems
    })
  }

  return (
    <section id="features" className="px-4 sm:px-6 pb-16 sm:pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
          <div className="relative rounded-2xl sm:rounded-[2.5rem] border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 p-2 sm:p-4 shadow-2xl animate-in fade-in zoom-in duration-1000">
            <img
              src={dashboardMockup}
              alt="PaySphere Dashboard"
              className="rounded-xl sm:rounded-3xl w-full shadow-lg"
            />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cards.map((card) => card.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {cards.map((card) => (
                  <SortableCard
                    key={card.id}
                    id={card.id}
                    title={card.title}
                    value={card.value}
                    subtitle={card.subtitle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-16 sm:mt-24 md:mt-32 text-center">
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 sm:mb-10">
            TRUSTED BY MODERN TEAMS IN BHARAT
          </p>

          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 md:gap-16 lg:gap-20 opacity-40 grayscale hover:grayscale-0 dark:text-white transition-all duration-500">
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">
              CAMPPOINT
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">
              FASHION
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">
              LEADERIT
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">
              SIMPLIFY
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-black italic">
              SKILLS
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
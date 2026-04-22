import { builtInLibrary } from '../../lib/library'
import { useProjectStore } from '../../store/projectStore'
import { LibraryItem } from './LibraryItem'

export const LibraryPanel = () => {
  const addEquipment = useProjectStore((state) => state.addEquipment)

  return (
    <aside className="h-full border-r border-slate-700 bg-slate-950 p-3 text-slate-100">
      <h2 className="mb-3 text-sm font-semibold">Equipment Library</h2>
      <div className="space-y-2">
        {builtInLibrary.map((item, index) => (
          <LibraryItem
            key={`${item.name}-${index}`}
            item={item}
            onAdd={() =>
              addEquipment({
                ...item,
                x: 80 + index * 20,
                y: 80 + index * 20,
              })
            }
          />
        ))}
      </div>
    </aside>
  )
}

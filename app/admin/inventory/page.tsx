"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryGauge } from "@/components/admin/InventoryGauge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Minus, Plus, Package } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface InventoryItemData {
  id: string;
  stationId: string;
  itemName: string;
  initialCount: number;
  remainingCount: number;
  unit: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<InventoryItemData | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchInventory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/inventory", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const openEdit = (item: InventoryItemData) => {
    setEditItem(item);
    setEditValue(item.remainingCount.toString());
  };

  const adjustValue = (delta: number) => {
    const current = parseInt(editValue) || 0;
    const newVal = Math.max(0, current + delta);
    setEditValue(newVal.toString());
  };

  const saveEdit = async () => {
    if (!editItem || !user) return;
    const newCount = parseInt(editValue);
    if (isNaN(newCount) || newCount < 0) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/inventory/${editItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ remainingCount: newCount }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === editItem.id
              ? { ...item, remainingCount: newCount }
              : item
          )
        );
      }
    } catch {
      // silently fail
    }
    setEditItem(null);
  };

  const totalItems = items.length;
  const depletedItems = items.filter((i) => i.remainingCount === 0).length;
  const lowStockItems = items.filter((i) => {
    const pct = i.initialCount > 0 ? (i.remainingCount / i.initialCount) * 100 : 0;
    return i.remainingCount > 0 && pct <= 25;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Track food and supply levels across all stations
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInventory}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{lowStockItems}</p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div>
              <p className="text-2xl font-bold">{depletedItems}</p>
              <p className="text-xs text-muted-foreground">Depleted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory gauges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Items</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryGauge items={items} loading={loading} />
          {!loading && items.length > 0 && (
            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{item.itemName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(item)}
                  >
                    Adjust
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No inventory items found. Items will appear once stations and inventory are configured in Firestore.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust: {editItem?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Initial: {editItem?.initialCount} {editItem?.unit}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustValue(-10)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                className="w-24 text-center text-lg font-mono"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                type="number"
                min={0}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustValue(10)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

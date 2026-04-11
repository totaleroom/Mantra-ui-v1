'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, Cpu, DollarSign, Database } from 'lucide-react'
import type { AIModel } from '@/lib/types'

interface ModelSelectorProps {
  models: AIModel[]
}

export function ModelSelector({ models }: ModelSelectorProps) {
  const [search, setSearch] = useState('')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(search.toLowerCase()) ||
      model.provider.toLowerCase().includes(search.toLowerCase())
  )

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsRefreshing(false)
  }

  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, AIModel[]>)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Dynamic Model Selector</CardTitle>
            <CardDescription>
              Browse and select models from connected providers
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh Models
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>

        {/* Model List */}
        <div className="space-y-6">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {provider}
              </h4>
              <div className="grid gap-2">
                {providerModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                      selectedModel === model.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-secondary/50 border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{model.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Database className="w-3 h-3" />
                            {(model.contextLength / 1000).toFixed(0)}k ctx
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="w-3 h-3" />
                            ${model.pricing.input}/1k in
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedModel === model.id && (
                      <Badge className="bg-primary text-primary-foreground">
                        Selected
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredModels.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No models found matching your search.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

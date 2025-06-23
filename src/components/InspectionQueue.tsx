"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useInspection } from "@/contexts/InspectionContext";
import { Button } from "./ui/button";

export function InspectionQueue() {
  const { queue } = useInspection();

  if (queue.length === 0) {
    return null;
  }

  // Hide queue if all items are completed
  const allCompleted = queue.every(item => item.status === 'completed');
  if (allCompleted) {
    return null;
  }

  // Function to truncate long error messages
  const truncateError = (error: string) => {
    if (error.length > 100) {
      return `${error.substring(0, 100)}...`;
    }
    return error;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Inspection Queue</CardTitle>
        <CardDescription>Websites currently being analyzed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queue.map((item) => (
            <div key={item.id} className="border rounded-md p-4">
              <div className="flex justify-between mb-2">
                <span className="font-medium">{item.url}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  item.status === 'processing' 
                    ? 'bg-blue-100 text-blue-800' 
                    : item.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : item.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {item.status === 'processing' ? 'Processing' : 
                   item.status === 'pending' ? 'Pending' : 
                   item.status === 'failed' ? 'Failed' : 
                   'Complete'}
                </span>
              </div>
              
              {item.status !== 'failed' && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div 
                    className={`h-2.5 rounded-full ${
                      item.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              )}
              
              {item.error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  <div className="font-medium">Error:</div>
                  <div className="break-words">{truncateError(item.error)}</div>
                  {item.error.length > 100 && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs h-auto py-1" 
                            onClick={() => alert(item.error)}>
                      Show Full Error
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 
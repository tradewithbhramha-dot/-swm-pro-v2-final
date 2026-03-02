import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import LiveWorkerMap from "@/components/LiveWorkerMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Plus, Settings, Users, Zap, BarChart3, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * Admin Dashboard - Module 0
 * Location hierarchy management, auto-ward engine, staff management, QR generation
 */

export default function AdminDashboard() {
  const { user } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedTaluka, setSelectedTaluka] = useState<number | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<number | null>(null);

  // Fetch location hierarchy
  const { data: countries } = trpc.location.getCountries.useQuery();
  const { data: states } = trpc.location.getStatesByCountry.useQuery(
    { countryId: selectedCountry || 0 },
    { enabled: !!selectedCountry }
  );
  const { data: districts } = trpc.location.getDistrictsByState.useQuery(
    { stateId: selectedState || 0 },
    { enabled: !!selectedState }
  );
  const { data: talukas } = trpc.location.getTalukasByDistrict.useQuery(
    { districtId: selectedDistrict || 0 },
    { enabled: !!selectedDistrict }
  );
  const { data: villages } = trpc.location.getVillagesByTaluka.useQuery(
    { talukaId: selectedTaluka || 0 },
    { enabled: !!selectedTaluka }
  );
  const { data: wards } = trpc.ward.getByVillage.useQuery(
    { villageId: selectedVillage || 0 },
    { enabled: !!selectedVillage }
  );

  // Auto-generate wards mutation
  const autoGenerateWards = trpc.ward.autoGenerateWards.useMutation();

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to access the admin dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage locations, wards, staff, and system settings</p>
          </div>
          <Button className="btn-glass-primary">
            <Settings className="w-4 h-4 mr-2" />
            System Settings
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Total Wards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{wards?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all villages</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Active Workers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">On duty today</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                Collection Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Registered today</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground mt-1">Today's progress</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="tracking" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/50 backdrop-blur-sm rounded-[20px] p-1">
            <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
            <TabsTrigger value="hierarchy">Location Hierarchy</TabsTrigger>
            <TabsTrigger value="wards">Ward Management</TabsTrigger>
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Live Tracking Tab */}
          <TabsContent value="tracking" className="space-y-4">
            <LiveWorkerMap />
          </TabsContent>

          {/* Location Hierarchy Tab */}
          <TabsContent value="hierarchy" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Location Hierarchy</CardTitle>
                <CardDescription>Select location to view and manage wards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Country Selection */}
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={selectedCountry?.toString() || ""} onValueChange={(v) => setSelectedCountry(parseInt(v))}>
                    <SelectTrigger id="country" className="input-glass">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* State Selection */}
                {selectedCountry && (
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select value={selectedState?.toString() || ""} onValueChange={(v) => setSelectedState(parseInt(v))}>
                      <SelectTrigger id="state" className="input-glass">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* District Selection */}
                {selectedState && (
                  <div>
                    <Label htmlFor="district">District</Label>
                    <Select value={selectedDistrict?.toString() || ""} onValueChange={(v) => setSelectedDistrict(parseInt(v))}>
                      <SelectTrigger id="district" className="input-glass">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts?.map((d) => (
                          <SelectItem key={d.id} value={d.id.toString()}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Taluka Selection */}
                {selectedDistrict && (
                  <div>
                    <Label htmlFor="taluka">Taluka</Label>
                    <Select value={selectedTaluka?.toString() || ""} onValueChange={(v) => setSelectedTaluka(parseInt(v))}>
                      <SelectTrigger id="taluka" className="input-glass">
                        <SelectValue placeholder="Select taluka" />
                      </SelectTrigger>
                      <SelectContent>
                        {talukas?.map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Village Selection */}
                {selectedTaluka && (
                  <div>
                    <Label htmlFor="village">Village</Label>
                    <Select value={selectedVillage?.toString() || ""} onValueChange={(v) => setSelectedVillage(parseInt(v))}>
                      <SelectTrigger id="village" className="input-glass">
                        <SelectValue placeholder="Select village" />
                      </SelectTrigger>
                      <SelectContent>
                        {villages?.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ward Management Tab */}
          <TabsContent value="wards" className="space-y-4">
            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ward Management</CardTitle>
                  <CardDescription>
                    {selectedVillage ? `Wards in selected village (${wards?.length || 0})` : "Select a village to view wards"}
                  </CardDescription>
                </div>
                {selectedVillage && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="btn-glass-primary">
                        <Zap className="w-4 h-4 mr-2" />
                        Auto-Generate Wards
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Auto-Generate Wards</DialogTitle>
                        <DialogDescription>
                          This will divide the selected village into 10 equal spatial polygons
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          The system will automatically create 10 wards with equal spatial distribution.
                        </p>
                        <Button
                          className="btn-glass-primary w-full"
                          onClick={() => {
                            if (selectedVillage) {
                              autoGenerateWards.mutate({ villageId: selectedVillage, numberOfWards: 10 });
                            }
                          }}
                          disabled={autoGenerateWards.isPending}
                        >
                          {autoGenerateWards.isPending ? "Generating..." : "Generate 10 Wards"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {wards && wards.length > 0 ? (
                  <div className="space-y-3">
                    {wards.map((ward) => (
                      <div key={ward.id} className="flex items-center justify-between p-3 bg-white/50 rounded-[20px] border border-gray-200">
                        <div>
                          <p className="font-semibold text-foreground">{ward.name}</p>
                          <p className="text-sm text-muted-foreground">Ward #{ward.wardNumber}</p>
                        </div>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No wards found. Select a village to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Management Tab */}
          <TabsContent value="staff" className="space-y-4">
            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Staff Management</CardTitle>
                  <CardDescription>Manage workers and supervisors</CardDescription>
                </div>
                <Button className="btn-glass-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Staff
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Staff management interface coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Generate and view system reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button className="btn-glass-primary h-24 flex flex-col items-center justify-center">
                    <FileText className="w-6 h-6 mb-2" />
                    Daily Collection Report
                  </Button>
                  <Button className="btn-glass-primary h-24 flex flex-col items-center justify-center">
                    <BarChart3 className="w-6 h-6 mb-2" />
                    Weekly Performance
                  </Button>
                  <Button className="btn-glass-primary h-24 flex flex-col items-center justify-center">
                    <Users className="w-6 h-6 mb-2" />
                    Worker Analytics
                  </Button>
                  <Button className="btn-glass-primary h-24 flex flex-col items-center justify-center">
                    <MapPin className="w-6 h-6 mb-2" />
                    Coverage Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  runAnalysis,
  listAnalyses,
  getToken,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  List,
} from "lucide-react";
import { useRouter } from "next/navigation";

const AnalyzeSchema = z.object({
  purchase_price: z.coerce.number().gt(0, "Purchase price must be greater than 0"),
  down_payment: z.coerce.number().min(0, "Down payment cannot be negative"),
  loan_term_years: z.coerce.number().int().min(1, "Loan term must be at least 1 year").max(50),
  interest_rate: z.coerce.number().min(0, "Interest rate cannot be negative").max(30),
  rental_income: z.coerce.number().gt(0, "Rental income must be greater than 0"),
  property_tax_annual: z.coerce.number().min(0, "Property tax cannot be negative"),
  insurance_annual: z.coerce.number().min(0, "Insurance cannot be negative"),
  misc_opex_annual: z.coerce.number().min(0, "Operating expenses cannot be negative"),
});

type AnalyzeForm = z.infer<typeof AnalyzeSchema>;

type AnalysisResult = {
  id: string;
  purchase_price: number;
  rental_income: number;
  down_payment: number;
  loan_term_years: number;
  interest_rate: number;
  property_tax_annual: number;
  insurance_annual: number;
  misc_opex_annual: number;
  monthly_cash_flow: number;
  annual_cash_flow: number;
  cap_rate: number;
  cash_on_cash_return: number;
  total_return_roi: number;
  monthly_mortgage: number;
  monthly_expenses: number;
  noi_annual: number;
  loan_amount: number;
  created_at: string;
};

const DEFAULT_VALUES: AnalyzeForm = {
  purchase_price: 300000,
  down_payment: 60000,
  loan_term_years: 30,
  interest_rate: 6.5,
  rental_income: 2500,
  property_tax_annual: 4200,
  insurance_annual: 1800,
  misc_opex_annual: 3000,
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function metricColor(value: number): { bg: string; text: string; icon: any } {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return {
    bg: isPositive ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20",
    text: isPositive ? "text-success" : "text-destructive",
    icon: <Icon className="h-4 w-4" />,
  };
}

export default function AnalyzerPage() {
  const router = useRouter();

  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    listAnalyses()
      .then((r: any) => {
        setAnalyses(Array.isArray(r) ? r : []);
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to load saved analyses" });
      });
  }, [router]);

  const form = useForm<AnalyzeForm>({
    resolver: zodResolver(AnalyzeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleSubmit = useCallback(
    async (values: AnalyzeForm) => {
      setCalculating(true);
      try {
        const result: AnalysisResult = await runAnalysis({
          purchase_price: values.purchase_price,
          down_payment: values.down_payment,
          loan_term_years: values.loan_term_years,
          interest_rate: values.interest_rate,
          rental_income: values.rental_income,
          property_tax_annual: values.property_tax_annual,
          insurance_annual: values.insurance_annual,
          misc_opex_annual: values.misc_opex_annual,
        });
        setAnalyses((prev) => [result, ...prev]);
        toast({
          title: "Analysis complete",
          description: `Monthly cash flow: ${money(result.monthly_cash_flow)}`,
        });
      } catch (e: any) {
        toast({ title: "Analysis failed", description: e.message || "Unable to calculate metrics" });
      } finally {
        setCalculating(false);
      }
    },
    []
  );

  const onReset = useCallback(() => {
    form.reset(DEFAULT_VALUES);
  }, [form]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Rental Property Analyzer</h1>
        </div>
        <p className="text-muted-foreground">
          Input property details to calculate cash flow, cap rate, cash-on-cash return, and total ROI.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Inputs */}
        <div className="md:col-span-7 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Property &amp; Financing Inputs</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" /> Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Purchase Price</Label>
                    <Input
                      {...form.register("purchase_price")}
                      type="number"
                      placeholder="e.g. 300000"
                      className={form.formState.errors.purchase_price ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.purchase_price && (
                      <p className="text-xs text-destructive">{form.formState.errors.purchase_price.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Down Payment</Label>
                    <Input
                      {...form.register("down_payment")}
                      type="number"
                      placeholder="e.g. 60000"
                      className={form.formState.errors.down_payment ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.down_payment && (
                      <p className="text-xs text-destructive">{form.formState.errors.down_payment.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Loan Term (Years)</Label>
                    <Select
                      onValueChange={(v) => form.setValue("loan_term_years", Number(v))}
                      defaultValue={DEFAULT_VALUES.loan_term_years.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Years" />
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 20, 25, 30].map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y} years
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.loan_term_years && (
                      <p className="text-xs text-destructive">{form.formState.errors.loan_term_years.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Interest Rate (%)</Label>
                    <Input
                      {...form.register("interest_rate")}
                      type="number"
                      placeholder="e.g. 6.5"
                      className={form.formState.errors.interest_rate ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.interest_rate && (
                      <p className="text-xs text-destructive">{form.formState.errors.interest_rate.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Expected Monthly Rent</Label>
                    <Input
                      {...form.register("rental_income")}
                      type="number"
                      placeholder="e.g. 2500"
                      className={form.formState.errors.rental_income ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.rental_income && (
                      <p className="text-xs text-destructive">{form.formState.errors.rental_income.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Property Tax (Annual)</Label>
                    <Input
                      {...form.register("property_tax_annual")}
                      type="number"
                      placeholder="e.g. 4200"
                      className={form.formState.errors.property_tax_annual ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.property_tax_annual && (
                      <p className="text-xs text-destructive">{form.formState.errors.property_tax_annual.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Insurance (Annual)</Label>
                    <Input
                      {...form.register("insurance_annual")}
                      type="number"
                      placeholder="e.g. 1800"
                      className={form.formState.errors.insurance_annual ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.insurance_annual && (
                      <p className="text-xs text-destructive">{form.formState.errors.insurance_annual.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Misc. Operating Expenses (Annual)</Label>
                    <Input
                      {...form.register("misc_opex_annual")}
                      type="number"
                      placeholder="e.g. 3000"
                      className={form.formState.errors.misc_opex_annual ? "ring-destructive" : ""}
                    />
                    {form.formState.errors.misc_opex_annual && (
                      <p className="text-xs text-destructive">{form.formState.errors.misc_opex_annual.message}</p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={calculating}
                  className="w-full"
                >
                  {calculating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Calculating…
                    </>
                  ) : (
                    <>
                      <Home className="h-4 w-4 mr-2" />
                      Analyze Property
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {analyses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-4 w-4" /> Saved Analyses
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {analyses.slice(0, 5).map((a) => (
                    <div key={a.id} className="p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
                        <span>{money(a.purchase_price)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium mt-1">
                        <span className="text-foreground/70">Monthly Cash Flow</span>
                        <span
                          className={a.monthly_cash_flow >= 0 ? "text-success" : "text-destructive"}
                        >
                          {money(a.monthly_cash_flow)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span className="text-foreground/60">Cap Rate</span>
                        <span>{percent(a.cap_rate)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span className="text-foreground/60">Cash-on-Cash</span>
                        <span>{percent(a.cash_on_cash_return)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Investment Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {form.formState.isSubmitSuccessful ? null : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                  <Calculator className="h-12 w-12 mb-3 opacity-40" />
                  <p>Enter property details and run an analysis.</p>
                </div>
              )}
              {form.formState.isSubmitSuccessful && (
                <>
                  {(() => {
                    const values = form.getValues();
                    const loanAmount = Math.max(values.purchase_price - values.down_payment, 0);
                    const monthlyRate = values.interest_rate / 100 / 12;
                    const n = values.loan_term_years * 12;
                    const monthlyMortgage =
                      monthlyRate === 0
                        ? loanAmount / n
                        : loanAmount *
                          (monthlyRate * (1 + monthlyRate) ** n) /
                          ((1 + monthlyRate) ** n - 1);
                    const monthlyTax = values.property_tax_annual / 12;
                    const monthlyIns = values.insurance_annual / 12;
                    const monthlyMisc = values.misc_opex_annual / 12;
                    const monthlyExpenses =
                      monthlyMortgage + monthlyTax + monthlyIns + monthlyMisc;
                    const monthlyCashFlow = values.rental_income - monthlyExpenses;
                    const annualCashFlow = monthlyCashFlow * 12;
                    const annualGrossRent = values.rental_income * 12;
                    const opexAnnual =
                      values.property_tax_annual + values.insurance_annual + values.misc_opex_annual;
                    const noi = annualGrossRent - opexAnnual;
                    const capRate = (noi / values.purchase_price) * 100;
                    const coc = (annualCashFlow / values.down_payment) * 100;

                    return (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <MetricCard
                            label="Monthly Cash Flow"
                            value={money(monthlyCashFlow)}
                            change={percent(monthlyCashFlow)}
                            color={metricColor(monthlyCashFlow)}
                          />
                          <MetricCard
                            label="Annual Cash Flow"
                            value={money(annualCashFlow)}
                            change={percent(annualCashFlow)}
                            color={metricColor(annualCashFlow)}
                          />
                          <MetricCard
                            label="Cap Rate"
                            value={percent(capRate)}
                            change={`NOI ${money(noi)} / yr`}
                            color={metricColor(capRate)}
                          />
                          <MetricCard
                            label="Cash-on-Cash Return"
                            value={percent(coc)}
                            change={`on ${money(values.down_payment)} invested`}
                            color={metricColor(coc)}
                          />
                        </div>
                        <Card className="border bg-muted/50">
                          <CardHeader>
                            <CardTitle className="text-sm">Financing Summary</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 pt-0">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Loan Amount</span>
                              <span>{money(loanAmount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Monthly Mortgage (P&amp;I)</span>
                              <span>{money(monthlyMortgage)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Monthly Taxes</span>
                              <span>{money(monthlyTax)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Monthly Insurance</span>
                              <span>{money(monthlyIns)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-border pt-2">
                              <span className="text-muted-foreground">Total Monthly Expenses</span>
                              <span className="font-medium">{money(monthlyExpenses)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  change: string;
  color: { bg: string; text: string; icon: React.ReactNode };
}

function MetricCard({ label, value, change, color }: MetricCardProps) {
  return (
    <Card className={color.bg + " border"}>
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div>
          <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
          <p className="text-xs text-muted-foreground">{change}</p>
        </div>
        <div className="p-2 rounded-md">{color.icon}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold {color.text}">{value}</div>
      </CardContent>
    </Card>
  );
}

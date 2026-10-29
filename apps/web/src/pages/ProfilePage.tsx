/**
 * Profile page - displays user information
 */
import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {LogOut, Copy, CheckCircle} from "lucide-react";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const {user, logout, isLoading} = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-glow text-foreground">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-glow text-foreground">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No user data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createdDate = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-glow text-foreground py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Welcome, {user.first_name}
            </h1>
            <p className="text-muted-foreground mt-1">Your account information</p>
          </div>
          <Button
            onClick={handleLogout}
            disabled={isLoggingOut}
            variant="destructive"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>

        {/* Personal Information Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField
                label="First Name"
                value={user.first_name}
                onCopy={handleCopy}
                isCopied={copiedField === "firstName"}
              />
              <InfoField
                label="Last Name"
                value={user.last_name}
                onCopy={handleCopy}
                isCopied={copiedField === "lastName"}
              />
              <InfoField
                label="Email Address"
                value={user.email}
                onCopy={handleCopy}
                isCopied={copiedField === "email"}
              />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Account Status
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      user.is_active
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {user.is_active ? "✓ Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <InfoField
                label="Member Since"
                value={createdDate}
                onCopy={handleCopy}
                isCopied={copiedField === "createdDate"}
              />
              <InfoField
                label="User ID"
                value={user.id}
                onCopy={handleCopy}
                isCopied={copiedField === "userId"}
                copyable
              />
            </div>
          </CardContent>
        </Card>

        {/* Raw JSON Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Full Profile Data</CardTitle>
            <CardDescription>
              Raw JSON representation of your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              {JSON.stringify(user, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface InfoFieldProps {
  label: string;
  value: string;
  onCopy: (text: string, field: string) => void;
  isCopied: boolean;
  copyable?: boolean;
}

const InfoField = ({
  label,
  value,
  onCopy,
  isCopied,
  copyable = true,
}: InfoFieldProps) => {
  const fieldKey = label.toLowerCase().replace(/\s+/g, "");

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-foreground break-all font-medium">{value}</p>
        {copyable && (
          <button
            onClick={() => onCopy(value, fieldKey)}
            className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            title="Copy to clipboard"
          >
            {isCopied ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

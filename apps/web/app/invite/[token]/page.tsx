'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const acceptSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type AcceptForm = z.infer<typeof acceptSchema>;

interface InvitationDetails {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: { name: string };
}

type PageState = 'loading' | 'valid' | 'expired' | 'used' | 'invalid' | 'success';

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
  });

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`${API_URL}/api/users/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          if (data.error?.includes('expired')) {
            setPageState('expired');
          } else if (data.error?.includes('used') || data.error?.includes('cancelled')) {
            setPageState('used');
          } else {
            setPageState('invalid');
          }
          return;
        }

        setInvitation(data.data);
        if (data.data.name) {
          setValue('name', data.data.name);
        }
        setPageState('valid');
      } catch (error) {
        console.error('Error fetching invitation:', error);
        setPageState('invalid');
      }
    }

    if (token) {
      fetchInvitation();
    }
  }, [token, setValue]);

  const onSubmit = async (data: AcceptForm) => {
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/users/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          password: data.password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: result.error || 'Failed to accept invitation',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      setPageState('success');
      toast({
        title: 'Welcome to Super In Tech!',
        description: 'Your account has been created. You can now log in.',
      });

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const formatRole = (role: string) => {
    return role.charAt(0) + role.slice(1).toLowerCase();
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invitation
  if (pageState === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Invalid Invitation</h2>
            <p className="mt-2 text-center text-muted-foreground">
              This invitation link is invalid. Please contact your administrator for a new invitation.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (pageState === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Invitation Expired</h2>
            <p className="mt-2 text-center text-muted-foreground">
              This invitation has expired. Please ask your administrator to send you a new invitation.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already used invitation
  if (pageState === 'used') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Already Accepted</h2>
            <p className="mt-2 text-center text-muted-foreground">
              This invitation has already been used. If you have an account, you can log in.
            </p>
            <Button className="mt-6" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Account Created!</h2>
            <p className="mt-2 text-center text-muted-foreground">
              Your account has been created successfully. Redirecting to login...
            </p>
            <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invitation - show form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <span className="text-xl font-bold text-primary-foreground">ST</span>
          </div>
          <CardTitle className="text-2xl font-bold">Join Super In Tech</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as {formatRole(invitation!.role)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Invited by <span className="font-medium text-foreground">{invitation!.invitedBy.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Email: <span className="font-medium text-foreground">{invitation!.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                {...register('name')}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                {...register('confirmPassword')}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By accepting, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

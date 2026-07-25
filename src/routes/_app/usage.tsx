import { createFileRoute } from '@tanstack/react-router';
import { AccessDenied, PermissionsUnavailable } from '@/components/shared';
import { UsagePage } from '@/components/usage';
import { SystemCapabilities } from '@/constants';
import { useCapabilities } from '@/hooks';

export const Route = createFileRoute('/_app/usage')({
  component: UsageRoute,
});

function UsageRoute() {
  const { hasCapability, isLoading, isError } = useCapabilities();

  if (isLoading) return null;
  if (isError) return <PermissionsUnavailable />;
  if (!hasCapability(SystemCapabilities.READ_USERS)) {
    return <AccessDenied />;
  }

  return <UsagePage />;
}

import Layout from '../../../../layouts/Layout';
import ErrorBoundary from '../../../../components/ErrorBoundary';
import { useDashboardState } from '../../hooks/useDashboardState';
import DashboardSummary from './DashboardSummary';

export default function InsightsPage() {
  const { dashboardSummary } = useDashboardState();

  return (
    <Layout>
      <div className="section-container">
        <ErrorBoundary section="product insights">
          <DashboardSummary summary={dashboardSummary} />
        </ErrorBoundary>
      </div>
    </Layout>
  );
}

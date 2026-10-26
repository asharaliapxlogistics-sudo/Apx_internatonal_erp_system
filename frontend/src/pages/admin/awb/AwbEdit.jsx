import { Link, useParams } from "react-router-dom";
import LoadState from "../../../components/LoadState";
import { useApi } from "../../../hooks/useApi";
import { getAwb } from "../../../lib/awb";
import AwbForm from "./AwbForm";

// Edit a saved AWB in the same form as a new one.
export default function AwbEdit() {
  const { number } = useParams();
  const { data: awb, error, reload } = useApi(() => getAwb(number), [number]);

  if (error?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">AWB {number} not found</p>
        <Link
          to="/admin/awb"
          className="mt-3 inline-block text-sm font-semibold text-brand-500"
        >
          Back to Air Waybills
        </Link>
      </div>
    );
  }
  if (!awb) return <LoadState error={error} onRetry={reload} />;
  if (awb.status === "Void") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">AWB {number} is void</p>
        <p className="mt-1 text-sm text-slate-500">
          Remove the void first, then edit it.
        </p>
        <Link
          to={`/admin/awb/${number}`}
          className="mt-3 inline-block text-sm font-semibold text-brand-500"
        >
          Back to AWB {number}
        </Link>
      </div>
    );
  }
  return <AwbForm key={awb.number} existing={awb} />;
}

import type { SecurityCenterDataSource } from "./types";

export type SecurityCenterPageProps = {
  dataSource: SecurityCenterDataSource;
};

export function SecurityCenterPage({ dataSource }: SecurityCenterPageProps) {
  void dataSource;

  return (
    <main>
      <h1>账号安全中心</h1>
    </main>
  );
}

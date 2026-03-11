import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children, showFooter = true, adminTheme = false, fullHeight = false }) => {
  return (
    <div className={`min-h-screen flex flex-col ${adminTheme ? 'bg-gray-100' : ''}`}>
      <Navbar adminTheme={adminTheme} />
      {/* pt-16 accounts for fixed navbar height (h-16 = 64px) */}
      <main className={`flex-grow pt-16 ${fullHeight ? 'h-[calc(100vh-4rem)]' : ''} ${!showFooter && !fullHeight ? 'overflow-hidden' : ''}`}>
        {children}
      </main>
      {showFooter && <Footer adminTheme={adminTheme} />}
    </div>
  );
};

export default Layout;

import logo from '../../../logo.png';

const Logo = ({ className, ...rest }) => (
    <img
        src={logo}
        alt="Logo"
        className={`w-[45px] h-auto ${className}`}
        {...rest}
    />
);

export default Logo;